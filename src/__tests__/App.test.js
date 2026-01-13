import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import App from "../App";

describe("Link mobile App", () => {
  it("renders the welcome message and subtitle", () => {
    const { getByText } = render(<App />);

    expect(getByText("Welcome to Link Mobile App")).toBeTruthy();
    expect(getByText("Your digital health companion")).toBeTruthy();
  });

  it("renders the home note and base layout", () => {
    const { getByTestId, getByText } = render(<App />);

    expect(
      getByText(
        "Explore your care journey with quick access to symptom checks, nearby facilities, and your personalized health feed."
      )
    ).toBeTruthy();

    expect(getByTestId("home-screen")).toHaveStyle({
      backgroundColor: "#f8fafc",
    });
    expect(getByTestId("home-note")).toHaveStyle({
      textAlign: "center",
    });
  });

  it("navigates to the symptom checker screen", async () => {
    const { getByTestId, getByText } = render(<App />);

    fireEvent.press(getByTestId("nav-symptom-checker"));

    await waitFor(() => {
      expect(getByText("Symptom Checker")).toBeTruthy();
    });
  });

  it("navigates to the facility finder screen", async () => {
    const { getByTestId, getByText } = render(<App />);

    fireEvent.press(getByTestId("nav-facility-finder"));

    await waitFor(() => {
      expect(getByText("Find Facilities")).toBeTruthy();
    });
  });

  it("navigates to the health feed screen", async () => {
    const { getByTestId, getByText } = render(<App />);

    fireEvent.press(getByTestId("nav-health-feed"));

    await waitFor(() => {
      expect(getByText("Health Feed")).toBeTruthy();
    });
  });

  it("navigates to the profile screen", async () => {
    const { getByTestId, getByText } = render(<App />);

    fireEvent.press(getByTestId("nav-profile"));

    await waitFor(() => {
      expect(getByText("My Profile")).toBeTruthy();
    });
  });
});
