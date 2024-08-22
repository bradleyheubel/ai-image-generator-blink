import { NextResponse } from "next/server";
import Replicate from "replicate";
 
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});
 
// In production and preview deployments (on Vercel), the VERCEL_URL environment variable is set.
// In development (on your local machine), the NGROK_HOST environment variable is set.
const WEBHOOK_HOST = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : process.env.NGROK_HOST;
 
export async function POST(request : Request) {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error(
      'The REPLICATE_API_TOKEN environment variable is not set. See README.md for instructions on how to set it.'
    );
  }
 
  const { prompt } = await request.json();
 
  const options: any = {
    version: 'f2ab8a5bfe79f02f0789a146cf5e73d2a4ff2684a98c2b303d1e1ff3814271db',
    input: { prompt }
  }
 
  if (WEBHOOK_HOST) {
    options.webhook = `${WEBHOOK_HOST}/api/webhooks`
    options.webhook_events_filter = ["start", "completed"]
  }
 
  // A prediction is the result you get when you run a model, including the input, output, and other details
  const prediction = await replicate.predictions.create(options);
 
  if (prediction?.error) {
    return NextResponse.json({ detail: prediction.error }, { status: 500 });
  }
 
  return NextResponse.json(prediction, { status: 201 });
}