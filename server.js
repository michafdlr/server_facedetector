import express, { urlencoded } from 'express';
import bcrypt from 'bcrypt';
import cors from 'cors';
import knex from 'knex';

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
  // Store the hash in your password DB
  return hash // For now we are returning the hash for testing at the bottom
}

const checkUserPassword = async (enteredPassword, storedPasswordHash) =>
  await bcrypt.compare(enteredPassword, storedPasswordHash)

const app = express();

// app.use(urlencoded({extends: false}));
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

// const getUser = async (id) => {
//   const counter = await db('users').returning('counter').select('counter').where({id})
//     .then(response => Number(response[0].counter))
//   return counter
// }


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
  // res.send("user added")
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

app.listen(PORT, () => `App running on port ${PORT}`)
