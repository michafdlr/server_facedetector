import express from 'express';
import bcrypt from 'bcrypt';
import cors from 'cors';
import knex from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const db = knex({
  client: 'pg',
  connection: {
    host: '127.0.0.1',
    port: 5432,
    user: 'michaelfiedler',
    password: '',
    database: 'facedetector',
  },
});

const PORT = 8080

const saltRounds = 10

const storeUserPassword = (password, salt) =>
  bcrypt.hash(password, salt).then(storeHashInDatabase)

const storeHashInDatabase = (hash) => {
  return hash
}

const checkUserPassword = async (enteredPassword, storedPasswordHash) =>
  await bcrypt.compare(enteredPassword, storedPasswordHash)

const app = express();

app.use(express.json())
app.use(cors())


const addUser = async (name, email, password, res) => {
  const hash = await storeUserPassword(password, saltRounds)
  await db.transaction(trx => {
    trx.insert({
      hash: hash,
      email: email
    })
      .into('login')
      .returning('email')
      .then(loginEmail => {
        trx('users')
          .returning('*')
          .insert({
            name: name,
            email: loginEmail[0].email,
            joined: new Date()
          })
          .then(user => {
            res.json(user[0])
          })
      })
      .then(trx.commit)
      .catch(trx.rollback)
  })
  .catch(err => res.status(400).json("unable to register"))
}


app.get("/", (req, res) => {
  db('users').select().returning('*')
    .then(response => res.json(response))
    .catch(err => res.status(400).json('Problem fetching users'))
});

app.post("/signin", async (req, res) => {
  db('login').select('hash', 'email').where("email", "=", req.body.email)
    .then(async response => {
      const isValid = await checkUserPassword(req.body.password, response[0].hash)
      if (isValid) {
        return db('users').select().where("email", "=", req.body.email)
                .then(user => {
                  res.json(user[0])
                })
                .catch(err => res.status(500).json('unable to get user'))
      } else {
        res.status(401).json("unauthorized")
      }
    })
    .catch(err => res.status(401).json("no user with given email found"))
})

app.post("/register", async (req, res) => {
  const {name, email, password} = req.body
  await addUser(name, email, password, res)
})

app.get("/profile/:id", (req, res) => {
  const {id} = req.params
  db.select().from("users").where({id})
    .then(user => {
      if (user.length) {
        res.json(user[0])
      } else {
        res.status(400).json("not found")
      }
    })
    .catch(err => res.status(400).json('error getting user'));
})

app.put("/image", (req, res) => {
  const {id} = req.body
  db('users').where('id', '=', id).increment('counter', 1)
    .returning('counter')
    .then(counter => res.json(counter[0].counter))
    .catch(err => res.status(400).json('could not get user'))
})

app.put("/reset", async (req, res) => {
  const {email, password} = req.body
  db('login').select().where('email', '=', email).returning('*')
    .then(async response => {
      if (!response.length) {
        res.status(400).json('invalid email')
      } else {
        const hash = await storeUserPassword(password, saltRounds)
        db('login').where('email', '=', email).update({
          hash: hash
        }, ['email'])
          .then(loginEmail => res.status(200).json(loginEmail[0].email))
      }
    })
})

app.post('/api/proxy', async (req, res) => {
  const { url, data } = req.body;

  // Log the incoming request body to debug
  // console.log('Received request:', req.body);

  if (!url || !data) {
    res.status(400).json({ error: 'Bad Request: URL or data is missing' });
    return;
  }

  const requestOptions = {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Key ${process.env.API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: data
  };


  try {
    const response = await fetch(url, requestOptions);
    const result = await response.json();

    if (!response.ok) {
      console.error('Error with the request:', result);
      res.status(response.status).json(result);
    } else {
      res.status(response.status).json(result);
    }
  } catch (error) {
    console.error('Internal Server Error:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

app.listen(PORT, () => {console.log(`Server running on port ${PORT}`)})
