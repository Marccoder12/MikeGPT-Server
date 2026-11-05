const WebSocket = require("ws");
const DataBase = require("better-sqlite3");
const gropep = require("./groqEndpoint.js");


const uuid = require("uuid");
const { randomUUID } = require("node:crypto");
const { eventNames } = require("node:cluster");
const { stringify } = require("node:querystring");

const db = new DataBase("responses.db");
const wss = new WebSocket.Server({ port : 8080 });

function findResponse(text){
    const rows = db.prepare("SELECT response FROM responses WHERE ? LIKE '%' || trigger || '%'").all(text);
    if(rows.length === 0) return null;
    const pick = rows[Math.floor(Math.random() * rows.length)];
    return pick.response;
}

function randomIntro(){
    const rows = db.prepare("SELECT text FROM intros").all();
    if(rows.length === 0) return "Well, ";
    return rows[Math.floor(Math.random() * rows.length)].text;
}

function tryMath(text){
    const match = text.match(/(-?\d+(\.\d+)?)\s*([\+\-\*\/])\s*(-?\d+(\.\d+)?)/);
    if(!match) return null;
    const [, a, , op, b] = match;
    const x = parseFloat(a), y= parseFloat(b);
    let result;
    switch(op){
        case "+": result = x + y; break;
        case "-": result = x - y; break;
        case "*": result = x * y; break;
        case "/": result = x / y; break;
    }
    return `${randomIntro()} the answer is ${result}`
}


function subscribe(ws, eventName){
    ws.send(JSON.stringify({
        header: {
            version: 1,
            requestId: uuid.v4(),
            messagePurpose: "subscribe",
        },
        body: {
            eventName: eventName,
        }
    }));
}

function runCommand( ws, commandLine){
    ws.send(JSON.stringify({
        header: {
            version: 1,
            requestId: uuid.v4(),
            messagePurpose: "commandRequest",
            messageType: "commandRequest",
        },
        body: {
            version: 1,
            commandLine: commandLine,
            origin: {type: "player"},
        },
    }));
}
function sanitizeForMinecraft(text) {
    return text
        .replace(/[\u2018\u2019]/g, "'")   // smart single quotes → '
        .replace(/[\u201C\u201D]/g, '"')   // smart double quotes → "
        .replace(/[\u2013\u2014]/g, "-")   // en-dash / em-dash → -
        .replace(/\u2026/g, "...")         // ellipsis → ...
        .replace(/[^\x00-\x7F]/g, "");     // strip any other non-ASCII chars as a catch-all
}

function mikeReply(ws, text){
    const cleanText = sanitizeForMinecraft(text);
    const payLoad = JSON.stringify({
        rawtext: [{text: `§b[Mike]`},
            {text: `§r ${cleanText}`},
        ],
    });
    runCommand(ws, `tellraw @a ${payLoad}`);
}
function mikelocalReply(ws, text){
    let cleanText = sanitizeForMinecraft(text);
    const payLoad = JSON.stringify({
        rawtext: [{text: `§b[Mike]`},
            {text: `§r ${cleanText}`},
        ],
    });
    // runCommand(ws, `/scoreboard players set BevLo4946 fpat:mike_repsonse_flag 1 `);
    // runCommand(ws, `tag BevLo4946 add mike_rep_buf_${cleanText}`);
    
    // cleanText = cleanText.trim().replaceAll(" ", "(_-_)").replaceAll("'", "(_oneSlash_)");
    // cleanText = "mike_rep_buf_" + cleanText;
    // console.log("CleanText Before: ", cleanText)
    // runCommand(ws, `tag @a add ${cleanText}`);
    // console.log("CleanText: ", cleanText);
    runCommand(ws, `scriptevent fpmcm:response ${cleanText}`);
    
    console.log(cleanText);
    // runCommand(ws, `give @p apple`);
}

let isLocal = true;

wss.on("connection", (ws) => {
    console.log("Minecraft connected");
    subscribe(ws, "PlayerMessage");

    ws.on("message", (raw) => {
        // console.log("RAW:", raw.toString());
        const msg = JSON.parse(raw.toString());
        if(msg.header?.eventName === "PlayerMessage"){
            const text = msg.body.message;
            console.log("Chat:", text);

            if(text.startsWith("!ask")){
                const question = text.slice(4).trim();
                // const mathResult = tryMath(question);
                // if(mathResult){
                //     ws.send(mathResult);
                //     const response = `No Prob, the aswer is ${mathResult}`;
                //     mikeReply(ws, response);
                //     return;
                // }
                //...look up your SQLite response here...
                // findResponse(question);
                // // const response = `Easy Bro, you asked: ${question}`;
                runCommand(ws, `scriptevent fpmcm:prompt ${text}`);
                mikeReply(ws, findResponse(question));
                console.warn(`Question: ${question}`);
                
                // gropep.aiChatComplete(question).then((response) => {
                //     try{
                        
                //         console.log(JSON.stringify(response));
                //         // console.warn(`Response: ${response.choices[0].message.content}`);
                //         mikeReply(ws, response);
                //     }
                //     catch(error){
                //         console.error("Error parsing AI response:", error);
                //     }
                // });
            }
            else if(text.startsWith(`{"rawtext":[{"text":"`)){
                let prompt = text.replace(`{"rawtext":[{"text":"`, "!ask ");
                prompt = prompt.substr(0, prompt.length - 5);
                console.warn(`Question: ${prompt}`);
                mikelocalReply(ws, findResponse(prompt));
            }
        }


        // const text = raw.toString().trim().toLowerCase();
        // console.log("Recieved:", text);
        // const mathResult = tryMath(text);
        // if(mathResult){
        //     ws.send(mathResult);
        //     return;
        // }
        // const response = findResponse(text);
        // ws.send(response ?? "I Don't know that one yet, boss.");
    });
});

console.log("WS server running on ws://localhost:8080");