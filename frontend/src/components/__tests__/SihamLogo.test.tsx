import React from "react";
import { render } from "@testing-library/react-native";
import { SihamLogo } from "../SihamLogo";

describe("SihamLogo", () => {
  it("renders correctly with default props", () => {
    const { getByTestId } = render(<SihamLogo />);
    expect(getByTestId("siham-logo")).toBeTruthy();
  });
});
