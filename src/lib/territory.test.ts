import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { CITY_GEO } from "./cities";
import {
  STATE_TO_REGION,
  TERRITORIES,
  TERRITORY_CM,
  TERRITORY_COLOR,
  TERRITORY_LABEL,
  regionFromState,
  territoryFromCity,
} from "./territory";

const US_STATES_AND_DC = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID", "IL", "IN",
  "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT",
  "VT", "VA", "WA", "WV", "WI", "WY",
];

describe("region model", () => {
  it("puts every US state and DC in one of the four US regions, never Global", () => {
    const unassigned = US_STATES_AND_DC.filter((s) => regionFromState(s) === "OTHER");
    expect(unassigned).toEqual([]);
  });

  it("only uses known region codes", () => {
    for (const region of Object.values(STATE_TO_REGION)) {
      expect(TERRITORIES).toContain(region);
    }
  });

  it("follows the CM regions doc and the later moves", () => {
    expect(regionFromState("MI")).toBe("CENTRAL"); // moved from NE, 2026-08-31
    expect(regionFromState("OH")).toBe("NE");
    expect(regionFromState("IN")).toBe("CENTRAL");
    expect(regionFromState("KY")).toBe("SE");
    expect(regionFromState("HI")).toBe("WEST");
    expect(regionFromState("AK")).toBe("WEST");
    expect(regionFromState("TX")).toBe("CENTRAL");
    expect(regionFromState("FL")).toBe("SE");
    expect(regionFromState("NY")).toBe("NE");
  });

  it('reads "NE" as the state Nebraska (Central), not the Northeast region', () => {
    expect(regionFromState("NE")).toBe("CENTRAL");
  });

  it("puts BC and AB in West and the rest of Canada in Global", () => {
    expect(regionFromState("BC")).toBe("WEST");
    expect(regionFromState("AB")).toBe("WEST");
    expect(regionFromState("ON")).toBe("OTHER");
    expect(regionFromState("QC")).toBe("OTHER");
  });

  it("sends anything unknown to Global", () => {
    expect(regionFromState(null)).toBe("OTHER");
    expect(regionFromState("ZZ")).toBe("OTHER");
    expect(territoryFromCity(null)).toBe("OTHER");
    expect(territoryFromCity("Atlantis")).toBe("OTHER");
    expect(territoryFromCity("London, UK")).toBe("OTHER");
  });

  it("is case-insensitive on state codes", () => {
    expect(regionFromState("tx")).toBe("CENTRAL");
  });

  it("maps cities through their state", () => {
    expect(territoryFromCity("Detroit")).toBe("CENTRAL");
    expect(territoryFromCity("Boston")).toBe("NE");
    expect(territoryFromCity("Buffalo")).toBe("NE");
    expect(territoryFromCity("Vancouver")).toBe("WEST");
    expect(territoryFromCity("Edmonton")).toBe("WEST");
    expect(territoryFromCity("Toronto")).toBe("OTHER");
  });

  it("names the Global region and gives it Sean", () => {
    expect(TERRITORY_LABEL.OTHER).toBe("Global");
    expect(TERRITORY_CM.OTHER).toBe("Sean Navarro");
    expect(TERRITORY_CM.SE).toBe("Sean Navarro");
  });

  it("has a label, colour, and CM for every region", () => {
    for (const t of TERRITORIES) {
      expect(TERRITORY_LABEL[t]).toBeTruthy();
      expect(TERRITORY_COLOR[t]).toMatch(/^#[0-9a-f]{6}$/i);
      expect(TERRITORY_CM[t]).toBeTruthy();
    }
  });
});

describe("city geo table", () => {
  it("gives every US city a state, so none falls into Global by accident", () => {
    const missing = Object.values(CITY_GEO).filter((c) => c.country === "US" && !c.state);
    expect(missing.map((c) => c.name)).toEqual([]);
  });

  it("puts every US city in a US region", () => {
    const global = Object.values(CITY_GEO).filter(
      (c) => c.country === "US" && territoryFromCity(c.name) === "OTHER"
    );
    expect(global.map((c) => c.name)).toEqual([]);
  });
});

describe("regions map (public/regions-us-states.geojson)", () => {
  // The map colours are baked into the file; this keeps them in step with
  // STATE_TO_REGION (Michigan's move had to be made in both places by hand).
  const file = path.resolve(__dirname, "../../public/regions-us-states.geojson");
  const geo = JSON.parse(readFileSync(file, "utf8")) as {
    features: { properties: { code: string; region: string } }[];
  };

  it("has all 50 states and DC", () => {
    const codes = geo.features.map((f) => f.properties.code).sort();
    expect(codes).toEqual([...US_STATES_AND_DC].sort());
  });

  it("colours every state by the same region the app uses", () => {
    const drift = geo.features
      .filter((f) => f.properties.region !== regionFromState(f.properties.code))
      .map((f) => `${f.properties.code}: map=${f.properties.region} app=${regionFromState(f.properties.code)}`);
    expect(drift).toEqual([]);
  });
});
