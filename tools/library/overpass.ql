// Restaurants, cafes and grocery stores in a bounding box (south,west,north,east).
// Default box: Kansas City area — change it to your launch city.
[out:json][timeout:180];
(
  nwr["amenity"~"^(restaurant|fast_food|cafe)$"](38.95,-94.75,39.20,-94.45);
  nwr["shop"~"^(supermarket|grocery|greengrocer|convenience)$"](38.95,-94.75,39.20,-94.45);
);
out center tags;
