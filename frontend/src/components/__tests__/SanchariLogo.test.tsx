import React from "react";
import { render } from "@testing-library/react-native";
import { SanchariLogo } from "../SanchariLogo";

describe("SanchariLogo", () => {
  it("renders correctly with default props", () => {
    const { getByTestId } = render(<SanchariLogo />);
    expect(getByTestId("sanchari-logo")).toBeTruthy();
  });
});
