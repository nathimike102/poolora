import React from "react";
import { render } from "@testing-library/react-native";
import { PooloraLogo } from "../PooloraLogo";

describe("PooloraLogo", () => {
  it("renders correctly with default props", () => {
    const { getByTestId } = render(<PooloraLogo />);
    expect(getByTestId("poolora-logo")).toBeTruthy();
  });
});
