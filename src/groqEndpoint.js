import "dotenv/config.js";
import Groq from "groq-sdk";
import fs from "fs";
import screenshot from "screenshot-desktop";
import { Window } from "node-screenshots"
import anyAscii from "any-ascii";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const tools = [
    {
        type: "function",
        function: {
            name: "captureAndDescribeScreen",
            description: "Takes a screenshot of the Minecraft window and describes what's currently visible on screen — terrain, structures, mobs, inventory, etc. Use this ONLY when the player's question depends on seeing what's currently on their screen (e.g. 'what am I looking at', 'what is this block', 'what's in front of me').",
            parameters: {
                type: "object",
                properties: {},
                required: []
            }
        }
    }
];

let lastScene = "Nothing observed yet.";

function captureMinecraftWindow() {
    const windows = Window.all();
    const mcWindow = windows.find((w) => w.title().includes("Minecraft"));

    if (!mcWindow) {
        console.log("Minecraft window not found");
        return null;
    }

    const image = mcWindow.captureImageSync();
    fs.writeFileSync("screen.png", image.toPngSync());
    return "screen.png";
}

async function captureAndDescribeScreen(moreDet) {
    try {
        // const imgPath = await screenshot({ filename: "screen.jpg", format: "jpg", screen: "Minecraft" });
        const imgPath = captureMinecraftWindow();
        if(!imgPath) return lastScene;
        const imgBuffer = fs.readFileSync(imgPath);
        const base64Image = imgBuffer.toString("base64");

        const response = await groq.chat.completions.create({
            model: "qwen/qwen3.6-27b",
            messages: [
                {
                    role: "system",
                    content: `you are good at analyzing Minecraft Bedrock Edition screenshots and providing concise descriptions of the scene. You will describe what's visible in the screenshot in 2-3 concise sentences, including terrain, structures, mobs, inventory, and anything notable. You will also provide context based on the last observed scene and any additional description provided.
                    
                    Constraints:
                    -if added details are applied in descriptions, you will include them in the description, else you will give a normal descrption of what you see.`
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: `Describe what's visible in this Minecraft Bedrock screenshot in 2-3 concise sentences — terrain, structures, mobs, inventory, anything notable. with added context: ${lastScene} and description: ${moreDet}` },
                        // { type: "text", text: "Describe what's visible in this Minecraft Bedrock screenshot in 2-3 concise sentences — terrain, structures, mobs, inventory, anything notable." },
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                    ]
                }
            ]
        });

        lastScene = response.choices[0].message.content;
        console.log("Scene updated:", lastScene);
    } catch (err) {
        console.error("Screenshot/vision error:", err);
    }

    return lastScene;
}

// captureAndDescribeScreen();


// THe main AI implementation for the Minecraft chat bot, using the Groq SDK to generate responses based on user input and context. The function `aiChatComplete` takes a user's question or prompt, constructs a conversation with the AI model, and returns a concise, practical answer in a casual tone, suitable for Minecraft Bedrock Edition discussions. It also handles tool calls for capturing and describing the screen when necessary.
export async function aiChatComplete(text) {
    try{
    const messages =[
              {
        role: "system",
        content: `You are Mike a Friendly Bro with a sharp mouth and an expert in Minecraft Bedrock Edition — including add-ons, normal gameplay pvp and building, behavior packs, resource packs, scripting API (@minecraft/server), commands, world settings, and multiplayer/server setup (Realms, dedicated servers, Bedrock Dedicated Server).
                You're also a witty, sarcastic, and funny Minecraft player who can answer questions about the game in a casual, conversational tone, and won't miss an opportunity to roast the user in a funny way.
                You will answer questions about Minecraft Bedrock Edition in a concise and practical manner, providing code snippets or commands when relevant.
                If you're unsure whether something applies to the current Bedrock version, say so rather than guessing.
                You love roasts an insult in every reply. you talk like your'e in a whatsapp chat.
                your're also my best friend and you will answer questions in a casual, conversational tone, as if you're talking to a friend.
Constraints:
you only use the ASCII charset to reply with, not utf-8 or adding any other characters
-No emojis or charaters not supported in minecraft bedrck chat should be present in the response
-You usually always have a sarcastic deadpan tone, but you can be funny and witty when appropriate.
- Keep answers concise and practical, with code/commands in code blocks when relevant.
- If you're unsure whether something applies to the current Bedrock version, say so rather than guessing.
-your replies should be in a casual, conversational tone, as if you're talking to a friend,.
-don't add any emojis or characters that make the text look malformed or different in the minecraft chat, just characters that the minecraft chat can support
-You will anser the question or prompt with the added context from the image description section, if the user requires it in his/her prompt.
when talking about a long topic, break it into multiple responses, and when you do, you will continue the answer in the next message, and not repeat the previous message, but continue from where you left off. and also you'll end it smartly not just till character length full.
-when write multiple messages, you will continue the answer in the next message, and not repeat the previous message, but continue from where you left off. and also you'll end it smartly not just till character length full.
-only when mentioned to use the screenshot or what's on te screen do you use the screenshot or what's on the screen to answer the question, otherwise you will answer the question without using the screenshot or what's on the screen.
-Keep the answer length 20-255 characters long
`
// -keep the answer within the length of minecraft default chat length, which is 256 characters, and if the answer is longer than that, you will write till the length of the response is less or exactly 256 characters, and continue the reply in the next one if asked for.


      },
      { role: "user", content: text }
    ];

  let response = await groq.chat.completions.create({
    model: "openai/gpt-oss-120b", // current recommended model
    messages: messages,
    temperature: 0.7,
    max_tokens: 1000,
    tools: tools,
    tool_choice: "auto"
  });

      let responseMessage = response.choices[0].message;
    const toolCalls = responseMessage.tool_calls;

    // Step 2: if the model requested the tool, run it and feed the result back
    if (toolCalls) {
        messages.push(responseMessage);

        for (const toolCall of toolCalls) {
            if (toolCall.function.name === "captureAndDescribeScreen") {
                const sceneDescription = await captureAndDescribeScreen();
                messages.push({
                    role: "tool",
                    content: sceneDescription,
                    tool_call_id: toolCall.id
                });
            }
        }
        response = await groq.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: messages,
            temperature: 0.7,
            max_tokens: 1000,
        }).catch((error) => {
            console.log("Error in second completion:", error);
        });
        responseMessage = response.choices[0].message.content;
    }

    console.log("RESPONSE: ", response.choices[0].message.content);
    return anyAscii(responseMessage.content);
}catch(err){
    
    return "You Seem to be Offline";
}
}
//   console.log(response.choices[0].message.content);

// aiChatComplete();