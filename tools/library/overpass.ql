// Restaurants, cafes and grocery stores in a bounding box (south,west,north,east).
// Kansas City metro (D22, widened 2026-10-17): Kansas City MO incl. the Northland, Independence,
// Raytown, Grandview, Lee's Summit, Blue Springs; Kansas City KS (66103), Overland Park, Olathe,
// Lenexa, Shawnee / Mission, Prairie Village.
[out:json][timeout:300];
(
  nwr["amenity"~"^(restaurant|fast_food|cafe)$"](38.78,-94.95,39.36,-94.18);
  nwr["shop"~"^(supermarket|grocery|greengrocer|convenience)$"](38.78,-94.95,39.36,-94.18);
);
out center tags;
