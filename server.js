import express, { urlencoded } from 'express';
import bcrypt from 'bcrypt';
import cors from 'cors';

const PORT = 8080

const saltRounds = 10

const storeUserPassword = (password, salt) =>
  bcrypt.hash(password, salt).then(storeHashInDatabase)

const storeHashInDatabase = (hash) => {
  // Store the hash in your password DB
  return hash // For now we are returning the hash for testing at the bottom
}
const hash1 = await storeUserPassword("12345", saltRounds)
const hash2 = await storeUserPassword("09876", saltRounds)

const database = {
  users: [
    {
      "id": "1",
      "name": "michael",
      "email": "michael@gmail.com",
      "password": hash1,
      "counter": 0,
      "joined": new Date()
    },
    {
      "id": "2",
      "name": "laura",
      "email": "laura@gmail.com",
      "password": hash2,
      "counter": 0,
      "joined": new Date()
    }
  ]
}

const checkUserPassword = (enteredPassword, storedPasswordHash) =>
  bcrypt.compare(enteredPassword, storedPasswordHash)

const app = express();

// app.use(urlencoded({extends: false}));
app.use(express.json())
app.use(cors())


const addUser = async (name, email, password) => {
  const id = database.users.length + 1
  const hash = await storeUserPassword(password, saltRounds)
  const newUser = {
    "id": String(id),
    "name": name,
    "email": email,
    "password": hash,
    "counter": 0,
    "joined": new Date()
  }
  database.users.push(newUser)
}

const getUser = (id) => {
  let search = ''
  database.users.forEach(user => {
    if (user.id === id) {
      search = user
      return
    }
  })
  return search
}


app.get("/", (req, res) => res.send(database.users));

app.post("/signin", (req, res) => {
  if (req.body.email === database.users[0].email &&
    checkUserPassword(req.body.password, database.users[0].password)
    // req.body.password === database.users[0].password
  ) {
    res.status(200).send(`successfull login for ${req.body.email} with hash ${database.users[0].password}`)
  } else{
    res.status(400).send(`wrong password or no user with email ${req.body.email} registered`)
  }
})

app.post("/register", (req, res) => {
  const {name, email, password} = req.body
  addUser(name, email, password)
  res.status(200).send(database.users[database.users.length-1])
})

app.get("/profile/:id", (req, res) => {
  const {id} = req.params
  const user = getUser(id)
  if (user != "") {
    res.send(user)
  } else {
    res.status(400).send("not found")
  }
})

app.put("/image", (req, res) => {
  const {id} = req.body
  const user = getUser(id)
  if (user != "") {
    user.counter++
    res.json(user.counter)
  } else {
    res.status(400).send("user not found")
  }
})

app.listen(PORT, () => `App running on port ${PORT}`)
