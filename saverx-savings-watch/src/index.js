import { createApp } from "./handlers.js";
import { d1Store } from "./store.js";
import { createTwilioClient } from "./twilio.js";

export default {
  async fetch(request, env) {
    const app = createApp({ store: d1Store(env.DB), twilio: createTwilioClient(env), env });
    return app(request);
  },
  // Daily retention job: purge phone numbers and expired results (see wrangler.jsonc triggers)
  async scheduled(_event, env) {
    const out = await d1Store(env.DB).purge(Date.now());
    console.log("retention purge", JSON.stringify(out));
  },
};
