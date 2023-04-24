const express = require("express");
const path = require("path");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

//API-1

app.post("/register/", async (request, response) => {
  const { name, username, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  console.log(hashedPassword);
  const selectUserQuery = `
    SELECT *
    FROM user
    WHERE username= '${username}'`;
  const dbResponse = await db.get(selectUserQuery);
  if (dbResponse !== undefined) {
    response.status = 400;
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status = 400;
      response.send("Password is too short");
    } else {
      const registerQuery = `
            INSERT INTO
              user(name, username, password, gender)
            VALUES 
              (
                  '${name}',
                  '${username}',
                  '${hashedPassword}',
                  '${gender}'
              );`;
      await db.run(registerQuery);
      response.send("User created successfully");
    }
  }
});

//API-2

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API-3

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const getUsersQuery = `
    SELECT user.username AS username,
    tweet.tweet AS tweet,
    tweet.date_time AS dateTime
    FROM user JOIN tweet
    LIMIT 4
    `;
  const dbResponse = await db.all(getUsersQuery);
  response.send(dbResponse);
});

//API-4

app.get("/user/following/", authenticateToken, async (request, response) => {
  const getFollowingQuery = `
   SELECT name
    FROM user
    WHERE user_id IN (SELECT following_user_id FROM follower)
    `;
  const followingUsers = await db.all(getFollowingQuery);
  response.send(followingUsers);
});

//API-5

app.get("/user/follower/", authenticateToken, async (request, response) => {
  const getFollowerQuery = `
    SELECT name
    FROM user
    WHERE user_id IN (SELECT follower_user_id FROM follower)
    `;
  const followerUsers = await db.all(getFollowerQuery);
  response.send(followerUsers);
});

//API-6

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const getTweetQuery = `
    SELECT tweet,
    (SELECT COUNT(*) FROM reply WHERE tweet_id = ${tweetId}) AS replies,
    (SELECT COUNT(*) FROM LIKE WHERE tweet_id = ${tweetId}) AS likes
    FROM tweet
    WHERE tweet_id = ${tweetId}
    GROUP BY tweet 
    ;`;
  const getTweet = await db.get(getTweetQuery);
  response.send(getTweet);
});

module.exports = app;
