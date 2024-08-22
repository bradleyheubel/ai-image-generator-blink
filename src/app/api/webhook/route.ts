import { NextRequest, NextResponse } from "next/server";
import {
    ACTIONS_CORS_HEADERS,
    createPostResponse,
    ActionGetResponse,
    ActionPostResponse
  } from "@solana/actions";

export async function POST(req: NextRequest) {
    try {
        console.log("received msg")
        return new Response("received", {
            status: 201,
            headers: ACTIONS_CORS_HEADERS
        })
    } catch (err) {
      console.log("Error in POST /api/action", err);
      let message = "An unknown error occurred";
      if (typeof err == "string") message = err;
      return new Response(message, {
        status: 400,
        headers: ACTIONS_CORS_HEADERS,
      });
    }
  }
  