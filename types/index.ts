export interface CategoryType {
  id: string;
  name: string;
  slug: string;
}

export interface ProductType {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  images: string[];
  inventory: number;
  category: string;
  vendorName: string;
  rating: number;
}

export interface VendorType {
  id: string;
  storeName: string;
  description?: string;
  logoUrl?: string;
}

export interface UserType {
  id: string;
  name: string;
  email: string;
}

export interface CartItemType {
  id: string;
  name: string;
  price: number;
  image: string;
  quantity: number;
}
