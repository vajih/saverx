import { createApp } from "./handlers.js";
import { d1Store } from "./store.js";
import { createTwilioClient } from "./twilio.js";

export default {
  async fetch(request, env) {
    const app = createApp({ store: d1Store(env.DB), twilio: createTwilioClient(env), env });
    return app(request);
  },
};
