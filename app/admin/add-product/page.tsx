"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AddProductPage() {
  const [categories, setCategories] = useState<any[]>([]);
const [subcategories, setSubcategories] = useState<any[]>([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    price: "",
    comparePrice: "",
    stock: "",
    imageUrl: "",
    categoryId: "",
    subcategoryId: "",
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("categories")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      console.log("Category fetch error:", error);
      alert("Category load error: " + error.message);
      return;
    }

    setCategories(data || []);
  };
  const fetchSubcategories = async (categoryId: string) => {
  if (!categoryId) {
    setSubcategories([]);
    return;
  }

  const { data, error } = await supabase
    .from("subcategories")
    .select("id, name")
    .eq("category_id", categoryId)
    .order("name", { ascending: true });

  if (error) {
    console.log("Subcategory fetch error:", error);
    alert("Subcategory load error: " + error.message);
    return;
  }

  setSubcategories(data || []);
};

  const handleChange = (
  e: React.ChangeEvent<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >
) => {
  const { name, value } = e.target;

  if (name === "categoryId") {
    setForm({
      ...form,
      categoryId: value,
      subcategoryId: "",
    });

    fetchSubcategories(value);
    return;
  }

  setForm({
    ...form,
    [name]: value,
  });
};

  const handleSubmit = async () => {
    if (!form.title || !form.price || !form.categoryId || !form.subcategoryId) {
  alert("Please fill title, price, category and subcategory");
  return;
}

    const { error } = await supabase.from("products").insert([
      {
        title: form.title,
        description: form.description,
        price: Number(form.price),
        compare_at_price: form.comparePrice
          ? Number(form.comparePrice)
          : null,
        stock_quantity: form.stock ? Number(form.stock) : 0,
        image_url: form.imageUrl,
        category_id: form.categoryId,
        subcategory_id: form.subcategoryId,
        approval_status: "pending",
      },
    ]);

    if (error) {
      console.log("Product save error:", error);
      alert(error.message);
    } else {
      alert("Product Saved In Database");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-2xl mx-auto bg-white p-6 rounded-2xl shadow-md">
        <h1 className="text-3xl font-bold mb-6">Add Product</h1>

        <div className="space-y-4">
          <input
            type="text"
            name="title"
            placeholder="Product Title"
            value={form.title}
            onChange={handleChange}
            className="w-full border p-3 rounded-xl"
          />

          <textarea
            name="description"
            placeholder="Product Description"
            value={form.description}
            onChange={handleChange}
            className="w-full border p-3 rounded-xl h-32"
          />

          <input
            type="number"
            name="price"
            placeholder="Price"
            value={form.price}
            onChange={handleChange}
            className="w-full border p-3 rounded-xl"
          />

          <input
            type="number"
            name="comparePrice"
            placeholder="Compare Price"
            value={form.comparePrice}
            onChange={handleChange}
            className="w-full border p-3 rounded-xl"
          />

          <input
            type="number"
            name="stock"
            placeholder="Stock Quantity"
            value={form.stock}
            onChange={handleChange}
            className="w-full border p-3 rounded-xl"
          />

          <select
            name="categoryId"
            value={form.categoryId}
            onChange={handleChange}
            className="w-full border p-3 rounded-xl"
            required
          >
            <option value="">Select Category</option>

            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
  name="subcategoryId"
  value={form.subcategoryId}
  onChange={handleChange}
  className="w-full border p-3 rounded-xl"
  required
>
  <option value="">Select Subcategory</option>

  {subcategories.map((s) => (
    <option key={s.id} value={s.id}>
      {s.name}
    </option>
  ))}
</select>

          <input
            type="text"
            name="imageUrl"
            placeholder="Image URL"
            value={form.imageUrl}
            onChange={handleChange}
            className="w-full border p-3 rounded-xl"
          />
          <input
  type="text"
  name="imageUrl"
  placeholder="Image URL"
  value={form.imageUrl}
  onChange={handleChange}
  className="w-full border p-3 rounded-xl"
/>

{form.imageUrl && (
  <img
    src={form.imageUrl}
    alt="Product preview"
    className="w-full h-64 object-cover rounded-xl border"
  />
)}

          <button
            onClick={handleSubmit}
            className="w-full bg-black text-white p-3 rounded-xl"
          >
            Save Product
          </button>
        </div>
      </div>
    </div>
  );
}