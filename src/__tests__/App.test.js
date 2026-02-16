import React from "react";
import { render } from "@testing-library/react-native";
import App from "../App";

describe("Link mobile App", () => {
  it("shows the login screen when logged out", async () => {
    const { findByText, findByTestId } = render(<App />);

    expect(await findByText("Welcome back")).toBeTruthy();
    expect(await findByTestId("login-email")).toBeTruthy();
    expect(await findByTestId("login-password")).toBeTruthy();
  });
});
