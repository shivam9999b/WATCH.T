import { supabase, supabaseConfigured, money, escapeHTML } from "./supabase.js";

const demoProducts = [
  {id:1,name:"Classic Men's Watch",category:"Men",price:1499,old_price:1999,image_url:"https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80",tag:"POPULAR"},
  {id:2,name:"Elegant Women's Watch",category:"Women",price:1299,old_price:1799,image_url:"https://images.unsplash.com/photo-1547996160-81dfa63595aa?auto=format&fit=crop&w=600&q=80",tag:"NEW"},
  {id:3,name:"Modern Smart Watch",category:"Smart Watch",price:2499,old_price:2999,image_url:"https://images.unsplash.com/photo-1544117519-31a4b719223d?auto=format&fit=crop&w=600&q=80",tag:"TRENDING"},
  {id:4,name:"Premium Luxury Watch",category:"Luxury",price:3999,old_price:4999,image_url:"https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=600&q=80",tag:"PREMIUM"},
  {id:5,name:"Minimal Wall Clock",category:"Wall Clock",price:999,old_price:1299,image_url:"https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?auto=format&fit=crop&w=600&q=80",tag:"HOME"},
  {id:6,name:"Watch Accessories",category:"Accessories",price:499,old_price:699,image_url:"https://images.unsplash.com/photo-1611591437281-460bfbe1220a?auto=format&fit=crop&w=600&q=80",tag:"ESSENTIAL"},
  {id:7,name:"Everyday Men's Watch",category:"Men",price:1799,old_price:2299,image_url:"https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=600&q=80",tag:"STYLE"},
  {id:8,name:"Premium Ladies Watch",category:"Women",price:1599,old_price:1999,image_url:"https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=600&q=80",tag:"ELEGANT"}
];

let products = [...demoProducts];
let selectedCategory = "All";
let cart = readCart();

function readCart() {
  try {
    const value = JSON.parse(localStorage.getItem("allWatchCart") || "[]");
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}
function saveCart() {
  localStorage.setItem("allWatchCart", JSON.stringify(cart));
}

const productGrid = document.getElementById("productGrid");
const emptyMessage = document.getElementById("emptyMessage");
const searchInput = document.getElementById("searchInput");
const cartPanel = document.getElementById("cartPanel");
const overlay = document.getElementById("overlay");

function renderProducts() {
  const query = (searchInput?.value || "").trim().toLowerCase();
  const filtered = products.filter(p =>
    (selectedCategory === "All" || p.category === selectedCategory) &&
    (`${p.name} ${p.category}`.toLowerCase().includes(query))
  );
  productGrid.innerHTML = filtered.map(p => `
    <article class="product-card">
      <span class="product-tag">${escapeHTML(p.tag || "WATCH")}</span>
      <a href="product.html?id=${encodeURIComponent(p.id)}" aria-label="View ${escapeHTML(p.name)}">
        <div class="product-image"><img src="${escapeHTML(p.image_url || p.image || "")}" alt="${escapeHTML(p.name)}" loading="lazy"></div>
      </a>
      <div class="product-info">
        <div class="product-category">${escapeHTML(p.category)}</div>
        <h3><a href="product.html?id=${encodeURIComponent(p.id)}" style="color:inherit;text-decoration:none">${escapeHTML(p.name)}</a></h3>
        <div class="product-price">${money(p.price)} ${Number(p.old_price ?? p.oldPrice ?? 0) > Number(p.price) ? `<del>${money(p.old_price ?? p.oldPrice)}</del><span class="discount-badge">${Math.round((1-Number(p.price)/Number(p.old_price ?? p.oldPrice))*100)}% OFF</span>` : ""}</div>
        <button class="add-btn" data-add="${escapeHTML(p.id)}">ADD TO CART +</button>
      </div>
    </article>`).join("");
  emptyMessage.hidden = filtered.length > 0;
}

function showToast(text) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2200);
}
function addToCart(id) {
  const p = products.find(item => String(item.id) === String(id));
  if (!p) return;
  const item = cart.find(x => String(x.id) === String(id));
  if (item) item.quantity = Math.min(99, Number(item.quantity || 0) + 1);
  else cart.push({id:p.id,name:p.name,category:p.category,price:Number(p.price),image:p.image_url || p.image,quantity:1});
  saveCart(); renderCart(); showToast("Added to cart!");
}
function changeQuantity(id, amount) {
  const item = cart.find(p => String(p.id) === String(id));
  if (!item) return;
  item.quantity = Number(item.quantity) + amount;
  if (item.quantity <= 0) cart = cart.filter(p => String(p.id) !== String(id));
  saveCart(); renderCart();
}
function renderCart() {
  const countEl = document.getElementById("cartCount");
  const itemsEl = document.getElementById("cartItems");
  const totalEl = document.getElementById("cartTotal");
  if (!countEl || !itemsEl || !totalEl) return;
  countEl.textContent = cart.reduce((s,p) => s + Number(p.quantity || 0), 0);
  totalEl.textContent = money(cart.reduce((s,p) => s + Number(p.price)*Number(p.quantity), 0));
  itemsEl.innerHTML = cart.length ? cart.map(p => `
    <div class="cart-item">
      <img src="${escapeHTML(p.image || "")}" alt="">
      <div><h4>${escapeHTML(p.name)}</h4><p>${money(p.price)}</p>
        <div class="quantity-controls">
          <button data-qty="${escapeHTML(p.id)}" data-change="-1">−</button>
          <span>${Number(p.quantity)}</span>
          <button data-qty="${escapeHTML(p.id)}" data-change="1">+</button>
        </div>
      </div>
      <button class="remove-btn" data-remove="${escapeHTML(p.id)}">Remove</button>
    </div>`).join("") : "<p>Your cart is empty.</p>";
}
function openCart(){cartPanel?.classList.add("open");overlay?.classList.add("show");}
function closeCart(){cartPanel?.classList.remove("open");overlay?.classList.remove("show");}
function selectCategory(category) {
  selectedCategory = category;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.toggle("active", b.dataset.category === category));
  renderProducts();
  document.getElementById("products")?.scrollIntoView({behavior:"smooth"});
}

productGrid?.addEventListener("click", e => {
  const btn = e.target.closest("[data-add]");
  if (btn) { e.preventDefault(); addToCart(btn.dataset.add); }
});
document.querySelectorAll(".filter-btn,.category-card").forEach(b => b.addEventListener("click", () => selectCategory(b.dataset.category)));
searchInput?.addEventListener("input", renderProducts);
document.getElementById("searchBtn")?.addEventListener("click", () => {
  const box = document.getElementById("searchBox"); box.classList.toggle("show");
  if (box.classList.contains("show")) searchInput?.focus();
});
document.getElementById("closeSearch")?.addEventListener("click", () => {
  document.getElementById("searchBox").classList.remove("show"); if(searchInput) searchInput.value=""; renderProducts();
});
document.getElementById("cartBtn")?.addEventListener("click", openCart);
document.getElementById("closeCart")?.addEventListener("click", closeCart);
overlay?.addEventListener("click", closeCart);
document.getElementById("menuBtn")?.addEventListener("click", () => document.getElementById("nav")?.classList.toggle("show"));
document.getElementById("nav")?.addEventListener("click", e => { if(e.target.closest("a")) document.getElementById("nav").classList.remove("show"); });
document.getElementById("cartItems")?.addEventListener("click", e => {
  const q=e.target.closest("[data-qty]"), r=e.target.closest("[data-remove]");
  if(q) changeQuantity(q.dataset.qty, Number(q.dataset.change));
  if(r){cart=cart.filter(p=>String(p.id)!==String(r.dataset.remove));saveCart();renderCart();}
});
document.getElementById("checkoutBtn")?.addEventListener("click", () => {
  if(!cart.length){showToast("Please add a product first.");return;}
  window.location.href="checkout.html";
});
const yearEl=document.getElementById("year"); if(yearEl) yearEl.textContent=new Date().getFullYear();

async function loadProducts() {
  if (supabaseConfigured) {
    const {data,error}=await supabase.from("products")
      .select("id,name,category,price,old_price,image_url,tag,description")
      .eq("active",true).order("created_at",{ascending:false});
    if (!error && data) products=data;
    else console.error("Supabase products error:",error?.message);
  }
  renderProducts(); renderCart();
}
loadProducts();