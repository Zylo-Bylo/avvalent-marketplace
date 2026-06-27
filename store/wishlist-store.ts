import { create } from "zustand";
import { persist } from "zustand/middleware";

type WishlistItem = {
  id: string | number;
  name: string;
  category: string;
  price: number;
  mrp?: number;
  discountPercent?: number;
  shippingCharge?: number;
  image: string;
};

type WishlistStore = {
  items: WishlistItem[];

  addItem: (item: WishlistItem) => void;

  removeItem: (id: string | number) => void;

  isInWishlist: (id: string | number) => boolean;
};

export const useWishlistStore =
  create<WishlistStore>()(
    persist(
      (set, get) => ({

        items: [],

        addItem: (item) =>
          set((state) => {

            const exists =
              state.items.find(
                (i) => i.id === item.id
              );

            if (exists) {
              return state;
            }

            return {
              items: [
                ...state.items,
                item,
              ],
            };
          }),

        removeItem: (id) =>
          set((state) => ({
            items: state.items.filter(
              (item) => item.id !== id
            ),
          })),

        isInWishlist: (id) =>
          get().items.some(
            (item) => item.id === id
          ),

      }),
      {
        name: "wishlist-storage",
      }
    )
  );
