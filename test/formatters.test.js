import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatForecast,
  formatBusArrivals,
  formatPlaces,
  haversineMetres,
  CT_HUB_2,
} from "../src/tools.js";
import { buildSystemPrompt } from "../src/prompt.js";
import { trimHistory } from "../src/loop.js";

test("formatPlaces reports open_now and distance from CT Hub 2", () => {
  const places = [
    {
      displayName: { text: "Open Kopitiam" },
      rating: 4.2,
      location: { latitude: 1.3073, longitude: 103.8631 },
      currentOpeningHours: { openNow: true },
    },
    {
      displayName: { text: "Closed Kopitiam" },
      rating: 4.5,
      location: CT_HUB_2,
      currentOpeningHours: { openNow: false },
    },
    { displayName: { text: "No Hours" }, location: CT_HUB_2 },
  ];

  const [open, closed, unknown] = formatPlaces(places, CT_HUB_2);
  assert.equal(open.open_now, true);
  assert.ok(open.distance_m > 400 && open.distance_m < 550);
  assert.equal(closed.open_now, false);
  assert.equal(closed.distance_m, 0);
  assert.equal(unknown.open_now, null);
  assert.equal(unknown.rating, null);
});

test("buildSystemPrompt is identical across calls so it can be cached", () => {
  assert.equal(buildSystemPrompt(), buildSystemPrompt());
  assert.match(buildSystemPrompt(), /^You are Lunch Uncle/);
});

test("trimHistory keeps only the most recent messages", () => {
  const history = Array.from({ length: 50 }, (_, i) => ({
    role: i % 2 ? "assistant" : "user",
    content: `m${i}`,
  }));
  const trimmed = trimHistory(history, 20);
  assert.equal(trimmed.length, 20);
  assert.equal(trimmed[0].content, "m30");
  assert.equal(trimmed.at(-1).content, "m49");
  assert.deepEqual(trimHistory(history.slice(0, 3), 20), history.slice(0, 3));
  assert.deepEqual(trimHistory("not an array"), []);
});

test("formatForecast picks the requested area", () => {
  const payload = {
    data: {
      items: [
        {
          valid_period: { text: "12 pm to 2 pm" },
          forecasts: [
            { area: "Geylang", forecast: "Fair" },
            { area: "Kallang", forecast: "Light Rain" },
          ],
        },
      ],
    },
  };

  assert.deepEqual(formatForecast(payload, "Kallang"), {
    area: "Kallang",
    forecast: "Light Rain",
    valid_period: "12 pm to 2 pm",
  });
});

test("formatBusArrivals converts durations to whole minutes", () => {
  const payload = {
    services: [
      {
        no: "13",
        next: { duration_ms: 100_798 },
        subsequent: { duration_ms: 1_210_000 },
      },
      { no: "107M", next: { duration_ms: 30_000 }, subsequent: null },
    ],
  };

  assert.deepEqual(formatBusArrivals(payload, "07371"), {
    stop_code: "07371",
    services: [
      { service: "13", next_min: 2, subsequent_min: 20 },
      { service: "107M", next_min: 1, subsequent_min: null },
    ],
  });
});

test("haversineMetres measures CT Hub 2 to Lavender MRT at under 600 m", () => {
  const ctHub2 = { latitude: 1.3115, longitude: 103.8615 };
  const lavenderMrt = { latitude: 1.3073, longitude: 103.8631 };
  const distance = haversineMetres(ctHub2, lavenderMrt);
  assert.ok(distance > 400 && distance < 550, `got ${distance}`);
});
