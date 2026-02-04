
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

// This is the worker script that will run the LLM in a background thread.
// It prevents the UI from freezing during generation.
const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (msg) => {
    handler.onmessage(msg);
};
