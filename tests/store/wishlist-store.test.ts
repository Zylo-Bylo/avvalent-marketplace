import { beforeEach, describe, expect, it } from "vitest";
import { useWishlistStore } from "@/store/wishlist-store";

const wishlistItem = {
  id: "product-1",
  name: "Test Product",
  category: "Testing",
  price: 250,
  image: "/product.png",
};

describe("wishlist store", () => {
  beforeEach(() => {
    useWishlistStore.setState({ items: [] });
  });

  it("adds a product once", () => {
    useWishlistStore.getState().addItem(wishlistItem);
    useWishlistStore.getState().addItem(wishlistItem);

    expect(useWishlistStore.getState().items).toEqual([wishlistItem]);
  });

  it("checks and removes wishlist membership", () => {
    useWishlistStore.getState().addItem(wishlistItem);

    expect(useWishlistStore.getState().isInWishlist("product-1")).toBe(true);

    useWishlistStore.getState().removeItem("product-1");

    expect(useWishlistStore.getState().isInWishlist("product-1")).toBe(false);
  });
});
