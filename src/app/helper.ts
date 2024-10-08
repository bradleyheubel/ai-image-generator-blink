
import { NextActionLink } from "@solana/actions-spec";

import axios from "axios"

// just a helper function to get the completed action at final stage [ last action in the chain ]
export const getCompletedAction = (data: Array<string>): NextActionLink => {
  return {
    type: "inline",
    action: {
      description: `Action ${data} completed`,
      icon: `https://action-chaining-example.vercel.app/${data}.webp`,
      label: `Action ${data} Label`,
      title: `Action ${data} completed`,
      type: "completed",
    },
  };
};

export const generateImgAction = (origin: string, data : Array<string>) : NextActionLink => {
  return {
    type: "post",
    href: `${origin}/api/action/generate?data=${JSON.stringify(data)}`
  }
}