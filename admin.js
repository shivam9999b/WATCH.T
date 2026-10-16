import { supabase, supabaseConfigured, money, escapeHTML } from "./supabase.js";

const notice = document.querySelector(".notice");
const productTable = document.getElementById("productTable");
const orderTable = document.getElementById("orderTable");
let products = [];
let orders = [];

function setNotice(text, isError=false) {
  notice.textContent=text;
  notice.style.color=isError?"#ffb5b5":"#e6d4a9";
}
function cell(row, value) {
  const td=document.createElement("td"); td.textContent=String(value ?? "—"); row.appendChild(td); return td;
}
function updateStats(){
  document.getElementById("productCount").textContent=products.length;
  document.getElementById("orderCount").textContent=orders.length;
  document.getElementById("revenue").textContent=money(orders.filter(o=>o.status!=="Cancelled").reduce((s,o)=>s+Number(o.total||0),0));
  document.getElementById("pendingCount").textContent=orders.filter(o=>o.status==="Pending").length;
}
function renderProducts(){
  productTable.replaceChildren();
  products.forEach(p=>{
    const tr=document.createElement("tr");
    const nameCell=cell(tr,"");
    const thumb=(Array.isArray(p.image_urls)?p.image_urls[0]:null)||p.image_url;
    if(thumb){const img=document.createElement("img");img.className="product-thumb";img.src=thumb;img.alt="";nameCell.appendChild(img);}
    nameCell.appendChild(document.createTextNode(p.name||""));
    cell(tr,p.category);
    const priceCell=cell(tr,"");
    const priceNow=document.createElement("strong");priceNow.textContent=money(p.price);priceCell.appendChild(priceNow);
    const oldPrice=Number(p.old_price||0);
    if(oldPrice>Number(p.price)){const del=document.createElement("del");del.style.marginLeft="8px";del.style.color="#999";del.textContent=money(oldPrice);priceCell.appendChild(del);}
    const td=cell(tr,"");
    const del=document.createElement("button");del.className="btn danger";del.textContent="Delete";
    del.addEventListener("click",()=>deleteProduct(p.id));
    td.appendChild(del);productTable.appendChild(tr);
  });
}
function renderOrders(){
  orderTable.replaceChildren();
  orders.forEach(o=>{
    const tr=document.createElement("tr");
    cell(tr,o.order_number ?? o.id);
    cell(tr,o.customer_name);
    cell(tr,money(o.total));
    cell(tr,o.payment_method === "COD" ? "Cash on Delivery (COD)" : (o.payment_method || "—"));
    const statusCell=cell(tr,"");
    const select=document.createElement("select");
    ["Pending","Confirmed","Processing","Shipped","Delivered","Cancelled"].forEach(st=>{
      const op=document.createElement("option");op.value=st;op.textContent=st;op.selected=o.status===st;select.appendChild(op);
    });
    select.addEventListener("change",()=>updateOrder(o.id,select.value));
    statusCell.appendChild(select);
    const actionCell=cell(tr,"");
    const receiptButton=document.createElement("button");
    receiptButton.type="button";
    receiptButton.className="btn secondary";
    receiptButton.textContent="Print Receipt";
    receiptButton.addEventListener("click",()=>printOrderReceipt(o));
    actionCell.appendChild(receiptButton);
    orderTable.appendChild(tr);
  });
}

function receiptEscape(value){
  return String(value ?? "—").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;", "'":"&#39;"}[ch]));
}
function receiptDate(value){
  if(!value)return "—";
  const date=new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"});
}
function getReceiptItems(order){
  let items=order.items ?? order.order_items ?? order.products ?? order.line_items ?? [];
  if(typeof items === "string"){
    try { items=JSON.parse(items); } catch { return []; }
  }
  if(items && !Array.isArray(items) && typeof items === "object") items=[items];
  if(!Array.isArray(items))return [];
  return items.map(item=>({
    name:item?.name ?? item?.product_name ?? item?.title ?? "Product",
    quantity:Number(item?.quantity ?? item?.qty ?? 1) || 1,
    price:Number(item?.price ?? item?.unit_price ?? item?.selling_price ?? 0) || 0,
    subtotal:Number(item?.subtotal ?? item?.line_total ?? ((Number(item?.price ?? item?.unit_price ?? item?.selling_price ?? 0) || 0) * (Number(item?.quantity ?? item?.qty ?? 1) || 1))) || 0
  }));
}
function printOrderReceipt(order){
  const receiptWindow=window.open("","_blank","width=800,height=700");
  if(!receiptWindow){setNotice("Receipt window blocked. Browser mein pop-ups allow karein.",true);return;}
  const items=getReceiptItems(order);
  const itemRows=items.length ? items.map(item=>`<tr><td>${receiptEscape(item.name)}</td><td>${item.quantity}</td><td>${receiptEscape(money(item.price))}</td><td>${receiptEscape(money(item.subtotal))}</td></tr>`).join("") : `<tr><td colspan="4" class="no-items">Item-wise details order record mein available nahi hain.</td></tr>`;
  const orderId=order.order_number ?? order.id ?? "—";
  const total=money(order.total);
  const paymentMethod=order.payment_method === "COD" ? "Cash on Delivery (COD)" : (order.payment_method || "—");
  const address=[order.address,order.city,order.state,order.pincode].filter(Boolean).join(", ");
  const customerDetails=[
    `<div><strong>Customer:</strong> ${receiptEscape(order.customer_name || order.customer || "—")}</div>`,
    `<div><strong>Phone:</strong> ${receiptEscape(order.phone || "—")}</div>`,
    `<div><strong>Email:</strong> ${receiptEscape(order.email || "—")}</div>`,
    `<div><strong>Delivery Address:</strong> ${receiptEscape(address || "—")}</div>`
  ].join("");
  const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Receipt ${receiptEscape(orderId)}</title><style>
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#222;margin:0;padding:28px;background:#fff}.receipt{max-width:720px;margin:auto;border:1px solid #ddd;padding:28px}.brand{text-align:center;border-bottom:2px solid #c5a45d;padding-bottom:18px;margin-bottom:20px}.brand h1{margin:0;color:#9b7934;letter-spacing:3px;font-size:27px}.brand p{margin:7px 0 0;color:#666;font-size:12px}.heading{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}.heading h2{margin:0 0 12px;font-size:20px}.meta{line-height:1.8;font-size:13px;overflow-wrap:anywhere}.meta strong{display:inline-block;min-width:112px}.delivery{margin-top:18px;padding:14px;background:#faf8f3;border:1px solid #eee}.delivery h3{margin:0 0 8px;font-size:15px}table{width:100%;border-collapse:collapse;margin-top:24px}th,td{padding:11px 8px;border-bottom:1px solid #ddd;text-align:left;font-size:13px}th{background:#f6f3ec}.no-items{text-align:center;color:#777}.total{margin:22px 0 0 auto;max-width:280px;display:flex;justify-content:space-between;font-size:20px;font-weight:bold;border-top:2px solid #c5a45d;padding-top:14px}.thanks{text-align:center;margin-top:30px;color:#777;font-size:12px}.print-actions{text-align:center;margin:0 auto 18px}.print-actions button{padding:10px 18px;border:0;background:#222;color:#fff;border-radius:5px;cursor:pointer}@media print{body{padding:0}.receipt{border:0;padding:10px}.print-actions{display:none}}
    </style></head><body><div class="print-actions"><button onclick="window.print()">Print Receipt</button></div><main class="receipt"><header class="brand"><h1> WATCH.T</h1><p>ORDER PAYMENT RECEIPT</p></header><div class="heading"><div><h2>Receipt</h2><div class="meta"><div><strong>Order ID:</strong> ${receiptEscape(orderId)}</div><div><strong>Order Date:</strong> ${receiptEscape(receiptDate(order.created_at || order.order_date || order.date))}</div><div><strong>Payment Method:</strong> ${receiptEscape(paymentMethod)}</div><div><strong>Payment Status:</strong> ${receiptEscape(order.payment_status || (order.payment_method === "COD" ? "Pay on delivery" : "—"))}</div><div><strong>Order Status:</strong> ${receiptEscape(order.status || "—")}</div></div></div></div><section class="delivery"><h3>Delivery Details</h3><div class="meta">${customerDetails}</div></section><table><thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead><tbody>${itemRows}</tbody></table><div class="total"><span>Total</span><span>${receiptEscape(total)}</span></div><p class="thanks">Thank you for shopping with Watch.T</p></main></body></html>`;
  receiptWindow.document.open();
  receiptWindow.document.write(html);
  receiptWindow.document.close();
  receiptWindow.focus();
}

async function requireAdmin(){
  if(!supabaseConfigured){setNotice("Supabase configured nahi hai. supabase.js mein Project URL aur anon key add karo.",true);return false;}
  const {data:{user},error}=await supabase.auth.getUser();
  if(error||!user){location.href="login.html";return false;}
  const {data:profile,error:profileError}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
  if(profileError||profile?.role!=="admin"){
    setNotice("Access denied: is account ka admin role set nahi hai. Admin role database mein secure tareeke se assign karo.",true);
    document.querySelectorAll("button, input, select").forEach(el=>el.disabled=true);
    return false;
  }
  return true;
}
async function loadData(){
  if(!await requireAdmin())return;
  const [p,o]=await Promise.all([
    supabase.from("products").select("*").order("created_at",{ascending:false}),
    supabase.from("orders").select("*").order("created_at",{ascending:false})
  ]);
  if(p.error||o.error){setNotice("Database error: "+(p.error?.message||o.error?.message),true);return;}
  products=p.data||[];orders=o.data||[];
  renderProducts();renderOrders();updateStats();
  setNotice("Supabase connected. Products aur orders database se load hue hain.");
}
document.querySelectorAll(".nav-btn").forEach(b=>b.addEventListener("click",()=>openSection(b.dataset.section)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>openSection(b.dataset.go)));
function openSection(id){
  document.querySelectorAll(".section").forEach(s=>s.classList.toggle("active",s.id===id));
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.section===id));
  document.getElementById("pageTitle").textContent=({dashboard:"Dashboard",products:"Products",orders:"Orders",sales:"Sales"})[id]||"Dashboard";
}
const form=document.getElementById("productForm");
const productImageFile=document.getElementById("productImageFile");
const productImageUrl=document.getElementById("productImage");
const productImagePreview=document.getElementById("productImagePreview");

document.getElementById("addProductBtn").addEventListener("click",()=>form.hidden=!form.hidden);
document.getElementById("cancelProductBtn").addEventListener("click",()=>{
  form.reset();
  clearImagePreviews();
  form.hidden=true;
});

function selectedImageFiles(){return Array.from(productImageFile?.files || []);}
function clearImagePreviews(){productImagePreview.replaceChildren();}
productImageFile?.addEventListener("change",()=>{
  const files=selectedImageFiles(); clearImagePreviews();
  if(files.length>6){setNotice("Maximum 6 images select karein.",true);productImageFile.value="";return;}
  for(const file of files){
    if(!file.type.startsWith("image/")){setNotice("Sirf image files select karein.",true);productImageFile.value="";clearImagePreviews();return;}
    if(file.size>5*1024*1024){setNotice("Har image 5 MB se chhoti honi chahiye.",true);productImageFile.value="";clearImagePreviews();return;}
  }
  files.forEach(file=>{const img=document.createElement("img");img.alt=file.name;img.src=URL.createObjectURL(file);productImagePreview.appendChild(img);});
  setNotice(files.length ? `${files.length} image(s) selected.` : "Images select karein.");
});
async function uploadProductImages(){
  const files=selectedImageFiles(), typedUrl=productImageUrl.value.trim();
  if(!files.length)return typedUrl?[typedUrl]:[];
  if(files.length>6)throw new Error("Maximum 6 images upload kar sakte hain.");
  const urls=[];
  for(let i=0;i<files.length;i++){
    const file=files[i];
    if(!file.type.startsWith("image/"))throw new Error("Sirf image files select karein.");
    if(file.size>5*1024*1024)throw new Error(`Image ${i+1} 5 MB se badi hai.`);
    const safeName=file.name.toLowerCase().replace(/[^a-z0-9._-]+/g,"-");
    const filePath=`products/${crypto.randomUUID()}-${safeName}`;
    const {error}=await supabase.storage.from("product-images").upload(filePath,file,{contentType:file.type,cacheControl:"3600",upsert:false});
    if(error)throw new Error(`Image ${i+1} upload failed: ${error.message}`);
    urls.push(supabase.storage.from("product-images").getPublicUrl(filePath).data.publicUrl);
  }
  return urls;
}
form.addEventListener("submit",async e=>{
  e.preventDefault();
  if(!supabaseConfigured)return setNotice("Supabase config missing.",true);
  const submitButton=form.querySelector('button[type="submit"]');
  submitButton.disabled=true;
  try {
    const imageUrls=await uploadProductImages();
    const payload={
      name:document.getElementById("productName").value.trim(),
      price:Number(document.getElementById("productPrice").value),
      old_price:Number(document.getElementById("productOldPrice").value)||null,
      category:document.getElementById("productCategory").value,
      image_url:imageUrls[0] || null,
      image_urls:imageUrls,
      active:true
    };
    if(!payload.name||!Number.isFinite(payload.price)||payload.price<=0){
      setNotice("Valid product name aur selling price enter karo.",true);
      return;
    }
    if(payload.old_price!==null && payload.old_price<=payload.price){
      setNotice("Original price selling price se zyada honi chahiye.",true);return;
    }
    const {error}=await supabase.from("products").insert(payload);
    if(error){setNotice("Product save nahi hua: "+error.message,true);return;}
    form.reset();
    clearImagePreviews();
    form.hidden=true;
    await loadData();
  } catch(error) {
    setNotice(error.message || "Product/image save nahi hua.",true);
  } finally {
    submitButton.disabled=false;
  }
});
async function deleteProduct(id){
  if(!confirm("Kya aap is product ko delete karna chahte hain?"))return;
  const {error}=await supabase.from("products").delete().eq("id",id);
  if(error){setNotice("Delete failed: "+error.message,true);return;}
  await loadData();
}
async function updateOrder(id,status){
  const {error}=await supabase.from("orders").update({status}).eq("id",id);
  if(error){setNotice("Order status update nahi hua: "+error.message,true);return;}
  await loadData();
}
document.getElementById("signOutBtn")?.addEventListener("click",async()=>{
  if(supabaseConfigured)await supabase.auth.signOut();
  location.href="login.html";
});
loadData();
