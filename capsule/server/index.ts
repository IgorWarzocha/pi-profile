import { capsule, query } from "lakebed/server";
import { DEFAULT_PROFILE } from "../shared/default-profile";

export default capsule({
  name: "Pi Profile",
  queries: {
    profile: query(() => DEFAULT_PROFILE),
  },
});
