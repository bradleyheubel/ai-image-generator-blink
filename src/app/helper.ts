
import { NextActionLink } from "@solana/actions-spec";

import axios from "axios"

// just a helper function to get the completed action at final stage [ last action in the chain ]
export const getCompletedAction = (data: Array<string>): NextActionLink => {
  // const response = axios.post("/api/predictions", {
  //       prompt: data[0],
  //     }).then((res) => {
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
    //   }).catch()
    // return response
};

export const nextAction = (data : Array<string>) : NextActionLink => {
  return {
    type: "post",
    href: `http://localhost:3000/api?data=${JSON.stringify(data)}`
  }
}

export const testAction = (data: Array<string>): NextActionLink => {

  return {
    type: "post",
    href: `http://localhost:3000/api?data=${JSON.stringify(data)}`
  }
}

export const getNextAction = (stage: string): NextActionLink => {
  return {
    type: "inline",
    action: {
      description: `Action ${stage}`,
      icon: `https://action-chaining-example.vercel.app/${stage}.webp`,
      label: `Action ${stage} Label`,
      title: `Action ${stage}`,
      type: "action",
      links: {
        actions: [
          {
            label: `Submit ${stage}`, // button text
            href: `/api/action?amount={amount}&stage=${stage}`, // api endpoint
            parameters: [
              {
                name: "amount", // field name
                label: "Enter a custom SOL amount", // text input placeholder
              },
            ],
          },
        ],
      },
    },
  };
};
