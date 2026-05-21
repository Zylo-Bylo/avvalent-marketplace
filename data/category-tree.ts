export type CategoryPart = {
  name: string;
  slug: string;
};

export type CategoryGroup = {
  name: string;
  slug: string;
  parts: CategoryPart[];
};

export type MainCategory = {
  name: string;
  slug: string;
  groups: CategoryGroup[];
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function part(name: string): CategoryPart {
  return {
    name,
    slug: slugify(name),
  };
}

function group(name: string, parts: string[]): CategoryGroup {
  return {
    name,
    slug: slugify(name),
    parts: parts.map(part),
  };
}

function mainCategory(name: string, groups: CategoryGroup[]): MainCategory {
  return {
    name,
    slug: slugify(name),
    groups,
  };
}

export const applianceCategoryTree: MainCategory[] = [
  mainCategory("Popular", [
    group("Top Picks", [
      "Sarees",
      "Kurtis",
      "Dresses",
      "T-Shirts",
      "Kitchen Storage",
      "Mobile Accessories",
    ]),
    group("Daily Deals", [
      "Beauty Combos",
      "Home Decor",
      "Kids Wear",
      "Footwear",
      "Bags",
      "Hardware Tools",
    ]),
    group("Repair Parts", [
      "AC Compressor",
      "Washing Machine Motor",
      "LED Panel",
      "Electric Switches",
      "Bathroom Taps",
      "Door Fittings",
    ]),
  ]),
  mainCategory("Kurti, Saree & Lehenga", [
    group("Sarees", [
      "Silk Sarees",
      "Cotton Sarees",
      "Georgette Sarees",
      "Chiffon Sarees",
      "Embroidered Sarees",
    ]),
    group("Kurtis", [
      "Anarkali Kurtis",
      "Straight Kurtis",
      "Printed Kurtis",
      "Kurti Sets",
      "Palazzo Sets",
    ]),
    group("Lehengas", [
      "Bridal Lehenga",
      "Party Lehenga",
      "Lehenga Choli",
      "Dupattas",
    ]),
  ]),
  mainCategory("Women Western", [
    group("Topwear", [
      "Tops",
      "Shirts",
      "Tunics",
      "Crop Tops",
      "Jackets",
    ]),
    group("Bottomwear", [
      "Jeans",
      "Trousers",
      "Skirts",
      "Shorts",
      "Palazzos",
    ]),
    group("Dresses", [
      "Casual Dresses",
      "Party Dresses",
      "Maxi Dresses",
      "Jumpsuits",
    ]),
  ]),
  mainCategory("Lingerie", [
    group("Innerwear", [
      "Bras",
      "Panties",
      "Camisoles",
      "Shapewear",
      "Thermals",
    ]),
    group("Sleepwear", [
      "Night Suits",
      "Night Dresses",
      "Robes",
      "Lounge Wear",
    ]),
    group("Essentials", [
      "Socks",
      "Slips",
      "Maternity Wear",
      "Sports Bra",
    ]),
  ]),
  mainCategory("Men", [
    group("Topwear", [
      "T-Shirts",
      "Casual Shirts",
      "Formal Shirts",
      "Sweatshirts",
      "Jackets",
    ]),
    group("Bottomwear", [
      "Jeans",
      "Trousers",
      "Shorts",
      "Track Pants",
      "Ethnic Wear",
    ]),
    group("Accessories", [
      "Belts",
      "Wallets",
      "Sunglasses",
      "Watches",
      "Caps",
    ]),
  ]),
  mainCategory("Kids & Toys", [
    group("Kids Clothing", [
      "Girls",
      "Boys",
      "Babies",
      "Clothing Sets",
      "Frocks & Dresses",
      "T-Shirt & Polos",
    ]),
    group("Kids Toys", [
      "Toys & Games",
      "Summer Picks",
      "Best Sellers",
      "Baby Gears",
    ]),
    group("Kids Accessories", [
      "Bags & Backpacks",
      "Kids Accessories",
      "Party Items",
    ]),
    group("Baby Care", [
      "View All",
      "Baby Bedding & Accessories",
      "Newborn Care",
      "Diapers",
      "Baby Mosquito Nets",
      "Baby Dry Sheets",
    ]),
  ]),
  mainCategory("Home & Kitchen", [
    group("Kitchen", [
      "Cookware",
      "Kitchen Storage",
      "Dinner Sets",
      "Lunch Boxes",
      "Water Bottles",
    ]),
    group("Home Furnishing", [
      "Bedsheets",
      "Curtains",
      "Cushion Covers",
      "Carpets",
      "Door Mats",
    ]),
    group("Home Improvement", [
      "Bathroom Fittings",
      "Electric Fittings",
      "Hardware Tools",
      "Door Locks",
      "Wall Shelves",
    ]),
  ]),
  mainCategory("Beauty & Health", [
    group("Makeup", [
      "Lipstick",
      "Foundation",
      "Kajal",
      "Nail Paint",
      "Makeup Kits",
    ]),
    group("Skin & Hair", [
      "Face Wash",
      "Moisturizer",
      "Shampoo",
      "Hair Oil",
      "Hair Accessories",
    ]),
    group("Health Care", [
      "Personal Care",
      "Health Devices",
      "Sanitizers",
      "Wellness",
    ]),
  ]),
  mainCategory("Jewellery & Accessories", [
    group("Jewellery", [
      "Earrings",
      "Necklaces",
      "Bangles",
      "Rings",
      "Jewellery Sets",
    ]),
    group("Accessories", [
      "Watches",
      "Sunglasses",
      "Hair Accessories",
      "Scarves",
      "Belts",
    ]),
    group("Occasion", [
      "Bridal Jewellery",
      "Party Wear",
      "Daily Wear",
      "Traditional",
    ]),
  ]),
  mainCategory("Bags & Footwear", [
    group("Bags", [
      "Handbags",
      "Sling Bags",
      "Backpacks",
      "Wallets",
      "Travel Bags",
    ]),
    group("Women Footwear", [
      "Flats",
      "Heels",
      "Sandals",
      "Shoes",
      "Slippers",
    ]),
    group("Men Footwear", [
      "Casual Shoes",
      "Formal Shoes",
      "Sports Shoes",
      "Sandals",
      "Flip Flops",
    ]),
  ]),
  mainCategory("AC Parts", [
    group("Indoor Unit", [
      "Evaporator Coil",
      "Blower Fan",
      "Air Filter",
      "Swing Motor",
      "PCB Board",
      "Temperature Sensor",
      "Drain Pipe",
    ]),
    group("Outdoor Unit", [
      "Compressor",
      "Condenser Coil",
      "Condenser Fan",
      "Capacitor",
      "Contactor Relay",
      "Service Valve",
    ]),
    group("Installation Parts", [
      "Copper Pipe",
      "Insulation Tape",
      "Wall Bracket",
      "Drain Hose",
      "Refrigerant Gas",
    ]),
  ]),
  mainCategory("Washing Machine Parts", [
    group("Mechanical Parts", [
      "Drum Tub",
      "Motor",
      "Belt",
      "Pulley",
      "Gearbox",
      "Shock Absorber",
    ]),
    group("Water System", [
      "Water Inlet Valve",
      "Drain Pump",
      "Drain Hose",
      "Water Level Sensor",
      "Detergent Dispenser",
    ]),
    group("Electrical Parts", [
      "PCB Board",
      "Timer",
      "Capacitor",
      "Display Panel",
      "Door Lock",
      "Power Cord",
    ]),
  ]),
  mainCategory("TV Parts", [
    group("Display Panels", ["LED Panel", "OLED Panel", "QLED Panel", "LCD Panel"]),
    group("Backlight Parts", [
      "LED Strip",
      "Diffuser Sheet",
      "Reflector Sheet",
      "Polarizer Film",
    ]),
    group("PCB Boards", [
      "Main Board",
      "Power Board",
      "T-Con Board",
      "Smart TV Board",
    ]),
    group("Audio & Remote", [
      "Speaker",
      "Audio IC",
      "Remote Control",
      "IR Sensor",
    ]),
  ]),
];

export function getPartHref(
  mainSlug: string,
  groupSlug: string,
  partSlug: string
) {
  return `/category/${mainSlug}/${groupSlug}/${partSlug}`;
}

export function findCategoryPart(
  mainSlug: string,
  groupSlug: string,
  partSlug: string
) {
  const main = applianceCategoryTree.find((item) => item.slug === mainSlug);
  const groupItem = main?.groups.find((item) => item.slug === groupSlug);
  const partItem = groupItem?.parts.find((item) => item.slug === partSlug);

  if (!main || !groupItem || !partItem) {
    return null;
  }

  return {
    main,
    group: groupItem,
    part: partItem,
  };
}
