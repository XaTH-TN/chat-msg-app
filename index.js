const socket = require("socket.io");
const cors = require("cors");
const request = require('request');
const { get_Current_User, user_Disconnect, join_User } = require("./dummyuser");

'use strict';

// Imports dependencies and set up http server
const
  express = require('express'),
  bodyParser = require('body-parser'),
  app = express().use(bodyParser.json()); 

app.use(express());

app.use(cors());
var server = app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

const io = socket(server);

// app.post('/webhook', (req, res) => {  
//   // Parse the request body from the POST
//   let body = req.body;

//   console.log(req.body);
//   // Check the webhook event is from a Page subscription
//   if (body.object === 'page') {

//     // Iterate over each entry - there may be multiple if batched
//     body.entry.forEach(function(entry) {

//       // Gets the body of the webhook event
//       let webhook_event = entry.messaging[0];
//       console.log(webhook_event);
    
    
//       // Get the sender PSID
//       let sender_psid = webhook_event.sender.id;
//       console.log('Sender PSID: ' + sender_psid);
    
//       // Check if the event is a message or postback and
//       // pass the event to the appropriate handler function
//       if (webhook_event.message) {
//         handleMessage(sender_psid, webhook_event.message);        
//       } else if (webhook_event.postback) {
//         handlePostback(sender_psid, webhook_event.postback);
//       }
      
//     });

//     // Return a '200 OK' response to all events
//     res.status(200).send('EVENT_RECEIVED');

//   } else {
//     // Return a '404 Not Found' if event is not from a page subscription
//     res.sendStatus(404);
//   }

// });
  
// Creates the endpoint for our webhook 
app.post('/webhook', (req, res) => {  
 
    // Parse the request body from the POST
  let body = req.body;

  console.log(req.body);
  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {

    // Iterate over each entry - there may be multiple if batched
    body.entry.forEach(function(entry) {

      // Gets the body of the webhook event
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);
    
    
      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      console.log('Sender PSID: ' + sender_psid);
    
      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
        console.log("handle message")
        handleMessage(sender_psid, webhook_event.message);        
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }
      
    });

    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED');

  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});
  // Adds support for GET requests to our webhook
app.get('/webhook', (req, res) => {

// Your verify token. Should be a random string.
  let VERIFY_TOKEN = "a8493a30-00f1-11ec-9a03-0242ac130003"
    
  // Parse the query params
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
    
  // Checks if a token and mode is in the query string of the request
  if (mode && token) {

    // Checks the mode and token sent is correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      
      // Responds with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);      
    }
  }
});
  
function handleMessage(sender_psid, received_message) {

  // Check if the message contains text
  if (received_message.text) {  
    let p_user = get_Current_User(sender_psid);

    console.log("p user: " + p_user)

    if (p_user.id === null || p_user.id === undefined) {
      console.log("ps id" + sender_psid)
      p_user = join_User(sender_psid, 'xath', 1);
    }

    console.log("p user after: " + p_user)
    io.to(p_user.room).emit("message", {
      userId: p_user.id,
      username: p_user.username,
      text: received_message.text,
    });  

    // Create the payload for a basic text message
    // response = {
    //   "text": `You sent the message: "${received_message.text}". Now send me an image!`
    // }
  }  
  
     
}

function callSendAPI(sender_psid, response) {
  // Construct the message body
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }

  // Send the HTTP request to the Messenger Platform
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": process.env.PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('message sent!')
    } else {
      console.error("Unable to send message:" + err);
    }
  }); 
}

function handlePostback(sender_psid, received_postback) {
  let response;
  
  // Get the payload for the postback
  let payload = received_postback.payload;

  // Set the response based on the postback payload
  if (payload === 'yes') {
    response = { "text": "Thanks!" }
  } else if (payload === 'no') {
    response = { "text": "Oops, try sending another image." }
  }
  // Send the message to acknowledge the postback
  callSendAPI(sender_psid, response);
}
// Sets server port and logs message on success

//initializing the socket io connection 
io.on("connection", (socket) => {
  //for a new user joining the room
  socket.on("joinRoom", ({ username, roomname }) => {
    //* create user
    const p_user = join_User(socket.id, username, roomname);
    console.log(socket.id, "=id");
    socket.join(p_user.room);

    //display a welcome message to the user who have joined a room
    socket.emit("message", {
      userId: p_user.id,
      username: p_user.username,
      text: `Welcome ${p_user.username}`,
    });

    //displays a joined room message to all other room users except that particular user
    socket.broadcast.to(p_user.room).emit("message", {
      userId: p_user.id,
      username: p_user.username,
      text: `${p_user.username} has joined the chat`,
    });
  });

  //user sending message
  socket.on("chat", ({text, userClient}) => {
    //gets the room user and the message sent
    const p_user = get_Current_User(socket.id);

    io.to(p_user.room).emit("message", {
      userId: p_user.id,
      username: p_user.username,
      text: text,
    });

    // Sends the response message
    callSendAPI(userClient, text); 
  });

  //when the user exits the room
  socket.on("disconnect", () => {
    //the user is deleted from array of users and a left room message displayed
    const p_user = user_Disconnect(socket.id);

    if (p_user) {
      io.to(p_user.room).emit("message", {
        userId: p_user.id,
        username: p_user.username,
        text: `${p_user.username} has left the room`,
      });

    }
  });
});