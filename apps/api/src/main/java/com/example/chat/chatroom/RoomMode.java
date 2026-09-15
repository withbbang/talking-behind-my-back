package com.example.chat.chatroom;

/** 방 모드 (SCHEMA.md #4). AI = 유저↔AI, HUMAN = 유저끼리(AI 휴면). 혼자면 항상 AI. 메시지에도 발신 당시 모드를 남긴다. */
public enum RoomMode { AI, HUMAN }
