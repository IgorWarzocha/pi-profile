import { capsule, endpoint, json } from "lakebed/server";
import { DEFAULT_PROFILE } from "../shared/profile";

export default capsule({
  name: "Pi Profile",
  endpoints: {
    profile: endpoint({ method: "GET", path: "/profile.json", readOnly: true }, () =>
      json(DEFAULT_PROFILE, { headers: { "Cache-Control": "no-cache" } })),
  },
});
