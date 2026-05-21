import { create } from "zustand";
import { persist } from "zustand/middleware";

type CartItem = {
  id: string | number;
  name: string;
  category: string;
  price: number;
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

  clearCart: () => void;
};

export const useCartStore =
  create<CartStore>()(
    persist(
      (set, get) => ({

        items: [],

        addItem: (item) =>
          set((state) => {

            const existing =
              state.items.find(
                (i) => i.id === item.id
              );

            if (existing) {
              return {
                items: state.items.map((i) =>
                  i.id === item.id
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

        clearCart: () =>
          set({ items: [] }),

      }),
      {
        name: "cart-storage",
      }
    )
  );
