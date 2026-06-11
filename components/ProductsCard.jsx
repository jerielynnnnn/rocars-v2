

// components/ProductCard.jsx
export default function ProductCard({ product }) {
  return (
    <article 
      className="product-card"
      aria-labelledby={`product-title-${product.id}`}
      role="article"
    >
      <img 
        src={product.image_url} 
        alt={product.name}
        role="img"
      />
      <h3 id={`product-title-${product.id}`}>{product.name}</h3>
      <p>Price: ₱{product.price}</p>
      <p>Stock: {product.stock} units</p>
      <button 
        aria-label={`Add ${product.name} to cart`}
        data-action="add-to-cart"
        onClick={() => addToCart(product)}
      >
        Add to Cart
      </button>
    </article>
  );
}