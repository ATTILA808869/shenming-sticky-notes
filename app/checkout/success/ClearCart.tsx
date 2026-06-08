"use client";

import { useEffect } from "react";

export function ClearCart() {
  useEffect(() => {
    localStorage.removeItem("god-note-cart");
    window.dispatchEvent(new Event("cart-updated"));
  }, []);
  return null;
}
