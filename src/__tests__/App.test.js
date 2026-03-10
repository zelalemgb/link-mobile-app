import React from "react";
import { render } from "@testing-library/react-native";
import App from "../App";

describe("Link mobile App", () => {
  it("shows the login screen when logged out", async () => {
    const { findByText, findByTestId } = render(<App />);

    expect(await findByText("Patient Portal")).toBeTruthy();
    expect(await findByText("Sign in with your phone number to access your Link records.")).toBeTruthy();
    expect(await findByTestId("login-phone")).toBeTruthy();
  });
});
