import { NextResponse } from "next/server";
import Replicate from "replicate";
 
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

interface Params {
  id: string;
}
 
export async function GET(request: Request, {params} : { params: Params}) {
  const { id } = params;
  const prediction = await replicate.predictions.get(id);
 
  if (prediction?.error) {
    return NextResponse.json({ detail: prediction.error }, { status: 500 });
  }
 
  return NextResponse.json(prediction);
}