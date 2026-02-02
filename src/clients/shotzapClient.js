import axios from "axios";
import { env } from "../config/env.js";

const client = axios.create({
  baseURL: env.SHOTZAP_BASE_URL,
  timeout: 20000
});

const postWithAuth = async (path, payload) => {
  const response = await client.post(path, payload, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.SHOTZAP_CONNECTION_TOKEN}`
    },
    maxBodyLength: Infinity
  });

  return response.data;
};

export const sendButtonsPro = async (payload) =>
  postWithAuth(env.SHOTZAP_SEND_BUTTONS_PATH, payload);

export const sendTextMessage = async (payload) =>
  postWithAuth(env.SHOTZAP_SEND_TEXT_PATH, payload);

export const addTag = async (payload) =>
  postWithAuth(env.SHOTZAP_TAG_ADD_PATH, payload);

export const removeTag = async (payload) =>
  postWithAuth(env.SHOTZAP_TAG_REMOVE_PATH, payload);
