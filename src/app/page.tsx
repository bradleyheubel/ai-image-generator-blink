'use client';
 
import { useState } from "react";
import Image from "next/image";
 
export default function Home() {
  return (
    <div className="container max-w-2xl mx-auto p-5 text-center">
      <Image className="mx-auto my-5" src="/eyes.png" alt="Eyes" width={200} height={200} />
      <h1 className="text-4xl font-bold mb-4">Solana AI Image Generator Blink</h1>

      <h2 className="text-2xl font-semibold mb-2">Create an image, launch a token!</h2>
      <p className="text-lg mb-4">Use AI to create an image, then create a new Pump.Fun token.</p>

      <a className="link text-blue-500 hover:underline" href="https://dial.to/?action=solana-action%3Ahttps%3A%2F%2Fwww.imggenblink.xyz%2Fapi%2Faction&cluster=mainnet">Check it out here</a>
    </div>
  );
}
