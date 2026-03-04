// Script to test gateway logic locally

import { io } from "socket.io-client";
import { IntentJoinRoom, IntentRequestSnapshot, IntentPlayerAction } from "./src/types";

const URL = "http://localhost:4000";
const socket1 = io(URL);
const socket2 = io(URL);

const ROOM_ID = "r_test_123";
const HAND_ID = "h_test_abc";
const SCHEMA_VERSION = 1;

socket1.on("connect", () => {
    console.log(`Socket 1 Connected: ${socket1.id}`);

    // Test Room Presence (socket1 joins)
    const joinIntent: IntentJoinRoom = {
        type: "INTENT_JOIN_ROOM",
        schema_version: SCHEMA_VERSION,
        room_id: ROOM_ID,
        client_msg_id: `join_${socket1.id}`
    };
    socket1.emit("INTENT_JOIN_ROOM", joinIntent);

    // Test Snapshot
    const snapIntent: IntentRequestSnapshot = {
        type: "INTENT_REQUEST_SNAPSHOT",
        schema_version: SCHEMA_VERSION,
        room_id: ROOM_ID,
        hand_id: HAND_ID,
        client_msg_id: `snap_${socket1.id}`
    };
    setTimeout(() => {
        socket1.emit("INTENT_REQUEST_SNAPSHOT", snapIntent);
    }, 500);
});

socket1.on("EVENT_STATE_SNAPSHOT", (data) => {
    console.log("Socket 1 Received Snapshot:", data);
});

socket1.on("EVENT_ACTION_CONFIRMED", (data) => {
    console.log("Socket 1 Received Action Ack:", data);
});

socket1.on("EVENT_STATE_UPDATE", (data) => {
    console.log("Socket 1 Received State Update:", data);
});

socket2.on("connect", () => {
    console.log(`Socket 2 Connected: ${socket2.id}`);

    // Test Room Presence (socket2 joins)
    const joinIntent: IntentJoinRoom = {
        type: "INTENT_JOIN_ROOM",
        schema_version: SCHEMA_VERSION,
        room_id: ROOM_ID,
        client_msg_id: `join_${socket2.id}`
    };
    socket2.emit("INTENT_JOIN_ROOM", joinIntent);

    // Test Player Action (socket2 sends an action)
    setTimeout(() => {
        const actionIntent: IntentPlayerAction = {
            type: "INTENT_PLAYER_ACTION",
            schema_version: SCHEMA_VERSION,
            room_id: ROOM_ID,
            hand_id: HAND_ID,
            client_msg_id: `action_${socket2.id}`,
            action: { type: "RAISE", amount: 100 }
        };
        console.log(`Socket 2 Sending Action: RAISE 100`);
        socket2.emit("INTENT_PLAYER_ACTION", actionIntent);
    }, 1000);

    setTimeout(() => {
        process.exit();
    }, 2000);
});

socket2.on("EVENT_STATE_UPDATE", (data) => {
    console.log("Socket 2 Received State Update:", data);
});
