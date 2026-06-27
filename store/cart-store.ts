import { create } from "zustand";
import { persist } from "zustand/middleware";

type CartItem = {
  id: string | number;
  productId?: string | number;
  variantId?: string | null;
  sizeLabel?: string | null;
  numericSize?: string | null;
  color?: string | null;
  sku?: string | null;
  name: string;
  category: string;
  price: number;
  mrp?: number;
  discountPercent?: number;
  shippingCharge?: number;
  image: string;
  quantity: number;
};

type CartStore = {
  items: CartItem[];

  addItem: (
    item: Omit<CartItem, "quantity">
  ) => void;

  getTotalItems: () => number;

  getTotalPrice: () => number;

  updateQuantity: (id: string | number, quantity: number) => void;

  removeItem: (id: string | number) => void;

  clearCart: () => void;
};

export const useCartStore =
  create<CartStore>()(
    persist(
      (set, get) => ({

        items: [],

        addItem: (item) =>
          set((state) => {

            const lineId =
              item.variantId && item.productId
                ? `${item.productId}:${item.variantId}`
                : item.id;
            const existing =
              state.items.find(
                (i) => i.id === lineId
              );

            if (existing) {
              return {
                items: state.items.map((i) =>
                  i.id === lineId
                    ? {
                        ...i,
                        quantity:
                          i.quantity + 1,
                      }
                    : i
                ),
              };
            }

            return {
              items: [
                ...state.items,
                {
                  ...item,
                  id: lineId,
                  productId: item.productId || item.id,
                  quantity: 1,
                },
              ],
            };
          }),

        getTotalItems: () =>
          get().items.reduce(
            (total, item) =>
              total + item.quantity,
            0
          ),

        getTotalPrice: () =>
          get().items.reduce(
            (total, item) =>
              total + item.price * item.quantity,
            0
          ),

        updateQuantity: (id, quantity) =>
          set((state) => ({
            items: state.items
              .map((item) =>
                item.id === id
                  ? {
                      ...item,
                      quantity: Math.max(1, quantity),
                    }
                  : item
              ),
          })),

        removeItem: (id) =>
          set((state) => ({
            items: state.items.filter((item) => item.id !== id),
          })),

        clearCart: () =>
          set({ items: [] }),

      }),
      {
        name: "cart-storage",
      }
    )
  );
