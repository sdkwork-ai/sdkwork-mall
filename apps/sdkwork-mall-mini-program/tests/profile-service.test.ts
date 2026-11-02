import { describe, expect, it } from "vitest";

import { toProfile } from "../src/services/profile-service";

describe("mini-program profile service", () => {
  it("maps the current-account summary onto the shared profile fields", () => {
    expect(
      toProfile({
        displayName: "张三",
        email: "zhangsan@example.com",
        membershipLevel: "黄金会员",
        phone: "13800000000",
      }),
    ).toEqual({
      displayName: "张三",
      email: "zhangsan@example.com",
      membershipLevel: "黄金会员",
      phone: "13800000000",
    });
  });

  it("falls back to alternative wire field names for each profile column", () => {
    expect(
      toProfile({
        levelName: "白银会员",
        mobile: "13900000000",
        nickname: "李四",
      }),
    ).toEqual({
      displayName: "李四",
      email: "",
      membershipLevel: "白银会员",
      phone: "13900000000",
    });
  });

  it("returns empty values for a payload without account fields", () => {
    expect(toProfile({})).toEqual({
      displayName: "",
      email: "",
      membershipLevel: "",
      phone: "",
    });
  });
});
