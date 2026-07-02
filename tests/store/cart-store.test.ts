import { beforeEach, describe, expect, it } from "vitest";
import { useCartStore } from "@/store/cart-store";

const baseItem = {
  id: "product-1",
  name: "Test Product",
  category: "Testing",
  price: 250,
  image: "/product.png",
};

describe("cart store", () => {
  beforeEach(() => {
    useCartStore.setState({ items: [] });
  });

  it("adds a new item with quantity one", () => {
    useCartStore.getState().addItem(baseItem);

    expect(useCartStore.getState().items).toEqual([
      {
        ...baseItem,
        productId: "product-1",
        quantity: 1,
      },
    ]);
  });

  it("increments quantity when adding the same item again", () => {
    useCartStore.getState().addItem(baseItem);
    useCartStore.getState().addItem(baseItem);

    expect(useCartStore.getState().items[0].quantity).toBe(2);
    expect(useCartStore.getState().getTotalItems()).toBe(2);
    expect(useCartStore.getState().getTotalPrice()).toBe(500);
  });

  it("uses product and variant ids to create a stable line item", () => {
    useCartStore.getState().addItem({
      ...baseItem,
      productId: "product-1",
      variantId: "variant-red-m",
    });

    expect(useCartStore.getState().items[0].id).toBe("product-1:variant-red-m");
  });

  it("keeps updated quantity at a minimum of one", () => {
    useCartStore.getState().addItem(baseItem);
    useCartStore.getState().updateQuantity("product-1", 0);

    expect(useCartStore.getState().items[0].quantity).toBe(1);
  });

  it("removes and clears items", () => {
    useCartStore.getState().addItem(baseItem);
    useCartStore.getState().removeItem("product-1");

    expect(useCartStore.getState().items).toEqual([]);

    useCartStore.getState().addItem(baseItem);
    useCartStore.getState().clearCart();

    expect(useCartStore.getState().items).toEqual([]);
  });
});
