// Product types mapping
const products = {
  ram: "RAM",
  ssd: "SSD",
  mouse: "Mouse",
  keyboard: "Keyboard",
  portable_storage: "Portable Storage",
  usb_hub: "USB Hub",
};

// ==================== UTILITY FUNCTIONS ====================
function showLoadingIndicator(container) {
  hideLoadingIndicator(); // Clear any existing loader
  const loadingDiv = document.createElement("div");
  loadingDiv.id = "loading-indicator";
  loadingDiv.innerHTML = `
    <div class="spinner"></div>
    <span>Finding the best products for you...</span>
  `;
  container.appendChild(loadingDiv);
}

function hideLoadingIndicator() {
  const loadingDiv = document.getElementById("loading-indicator");
  if (loadingDiv) loadingDiv.remove();
}

function displayErrorMessage(container, message) {
  container.querySelectorAll(".error-message").forEach((el) => el.remove());
  if (!message) return;

  const errorDiv = document.createElement("div");
  errorDiv.classList.add("error-message");
  errorDiv.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e74c3c">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span>${message}</span>
  `;
  container.appendChild(errorDiv);
}

// ==================== CORE FUNCTIONALITY ====================
function setupSearch() {
  const searchInput = document.querySelector(".input");
  const deviceCards = document.querySelectorAll(".device-card");
  const deviceGrid = document.querySelector(".device-grid");

  if (!searchInput || !deviceCards.length) return;

  searchInput.addEventListener("input", function () {
    const searchTerm = this.value.toLowerCase().trim();
    let hasResults = false;

    deviceCards.forEach((card) => {
      const title = card.querySelector("h3").textContent.toLowerCase();
      const shouldShow = title.includes(searchTerm);
      card.style.display = shouldShow ? "flex" : "none";
      if (shouldShow) hasResults = true;
    });

    const noResults = document.querySelector(".no-results");
    if (!hasResults && !noResults) {
      const message = document.createElement("p");
      message.classList.add("no-results");
      message.textContent = "No products found matching your search.";
      deviceGrid.appendChild(message);
    } else if (hasResults && noResults) {
      noResults.remove();
    }
  });
}

function setupNavigation() {
  // Home button functionality
  const homeBtn = document.getElementById("home");
  if (homeBtn) {
    homeBtn.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        e.preventDefault();
        window.location.href = "/main.html";
      }
    });
  }

  // Help button functionality
  const helpBtn = document.getElementById("help");
  if (helpBtn) {
    helpBtn.addEventListener("click", function () {
      alert("Need help? Contact our support team at support@specware.com");
    });
  }
}

// ==================== RECOMMENDATION SYSTEM ====================
async function fetchRecommendations(
  brand,
  model,
  userNeed,
  minPrice,
  maxPrice
) {
  if (!window.API_KEY) {
    throw new Error("API key not configured. Please check config.js");
  }

  // Enhanced prompt with specific technical requirements
  const prompt = `Provide exactly 3 compatible ${userNeed} options for ${brand} ${model} laptop within ₹${minPrice}-₹${maxPrice} budget available in India.
  
    TECHNICAL REQUIREMENTS:
    - For RAM: Must match laptop's specifications (DDR4/DDR5, SODIMM form factor, frequency)
    - For SSD: Must match interface (SATA/NVMe) and form factor (2.5"/M.2)
    - Must be currently available on Amazon.in or Flipkart.com
  
    RESPONSE FORMAT FOR EACH PRODUCT:
    ---
    Name: [Brand and exact model name with specs]
    Type: [DDR4/DDR5, Capacity, Speed]
    Price: ₹[Exact price]
    Amazon: [Full product URL or "Not available"]
    Flipkart: [Full product URL or "Not available"]
    In Stock: [Yes/No]
    Compatibility: [Specific details for ${brand} ${model}]
    Reason: [Why this is a good choice for this laptop]
    ---
  
    Example for RAM:
    ---
    Name: Crucial 8GB DDR4 3200MHz SODIMM
    Type: DDR4, 8GB, 3200MHz
    Price: ₹2,499
    Amazon: https://www.amazon.in/dp/B08C511GQH
    Flipkart: https://www.flipkart.com/crucial-8gb-ddr4-3200mhz/p/itm12345
    In Stock: Yes
    Compatibility: Compatible with ASUS FA706IHRB's DDR4 SODIMM slot
    Reason: Matches the laptop's specifications perfectly and provides good performance boost
    ---`;

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${window.API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.href,
          "X-Title": "Specware",
        },
        body: JSON.stringify({
          model: "deepseek/deepseek-chat-v3-0324:free",
          messages: [
            {
              role: "system",
              content: `You are a technical expert specializing in ${brand} laptop compatibility. 
              Provide only currently available products in India with verified compatibility. 
              Format responses exactly as requested.`,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 1500,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("API Error:", error);
      throw new Error("Server error. Please try again in a moment.");
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Network Error:", error);
    throw new Error(
      "Connection issue. Please check your internet and try again."
    );
  }
}

function parseApiResponse(data) {
  try {
    const content = data.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response received from the server");
    }

    console.log("Raw API Response:", content);

    const productBlocks = content
      .split(/---+/)
      .map((block) => block.trim())
      .filter((block) => block && !block.startsWith("TECHNICAL"));

    const recommendations = [];

    for (const block of productBlocks.slice(0, 3)) {
      const product = {
        name: "",
        specs: "",
        price: "",
        amazon: "#",
        flipkart: "#",
        inStock: false,
        compatibility: "",
        reason: "",
      };

      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line);

      for (const line of lines) {
        const lowerLine = line.toLowerCase();

        if (lowerLine.startsWith("name:")) {
          product.name = line.substring(5).trim();
        } else if (lowerLine.startsWith("type:")) {
          product.specs = line.substring(5).trim();
        } else if (lowerLine.startsWith("price:")) {
          const priceMatch = line.match(/₹\s*[\d,]+/);
          if (priceMatch) product.price = priceMatch[0];
        } else if (lowerLine.startsWith("amazon:")) {
          const urlMatch = line.match(/https?:\/\/[^\s]+/i);
          if (urlMatch) product.amazon = urlMatch[0];
        } else if (lowerLine.startsWith("flipkart:")) {
          const urlMatch = line.match(/https?:\/\/[^\s]+/i);
          if (urlMatch) product.flipkart = urlMatch[0];
        } else if (lowerLine.startsWith("in stock:")) {
          product.inStock = lowerLine.includes("yes");
        } else if (lowerLine.startsWith("compatibility:")) {
          product.compatibility = line.substring(14).trim();
        } else if (lowerLine.startsWith("reason:")) {
          product.reason = line.substring(7).trim();
        }
      }

      // Validate we have minimum required data
      if (
        product.name &&
        product.price &&
        (product.amazon !== "#" || product.flipkart !== "#")
      ) {
        recommendations.push(product);
      }
    }

    if (recommendations.length === 0) {
      throw new Error(
        "No compatible products found within your budget and requirements."
      );
    }

    return recommendations;
  } catch (error) {
    console.error("Parsing Error:", error);
    throw new Error(
      "We couldn't process the recommendations. Please try adjusting your search criteria."
    );
  }
}

// ==================== FORM HANDLING ====================
async function handleFormSubmit(event) {
  event.preventDefault();
  const container = document.querySelector(".select-container");
  displayErrorMessage(container, "");

  // Get all form values from select.html
  const brand = document.getElementById("brand").value;
  const model = document.getElementById("modelno").value.trim();
  const userNeed = document.getElementById("drop").value;
  const minPrice = parseInt(document.getElementById("rs").value);
  const maxPrice = parseInt(document.getElementById("rs1").value);
  const quality = document.getElementById("quality").value;

  // Enhanced validation
  if (!model || model.length < 3) {
    return displayErrorMessage(
      container,
      "Please enter a valid laptop model (at least 3 characters)"
    );
  }
  if (isNaN(minPrice) || minPrice < 0) {
    return displayErrorMessage(container, "Minimum price must be ₹0 or more");
  }
  if (isNaN(maxPrice)) {
    return displayErrorMessage(container, "Please enter a valid maximum price");
  }
  if (maxPrice <= minPrice) {
    return displayErrorMessage(
      container,
      "Maximum price must be greater than minimum"
    );
  }
  if (maxPrice - minPrice < 100) {
    return displayErrorMessage(
      container,
      "Price range should be at least ₹100"
    );
  }

  showLoadingIndicator(container);

  try {
    const apiResponse = await fetchRecommendations(
      brand,
      model,
      userNeed,
      minPrice,
      maxPrice,
      quality
    );
    const recommendations = parseApiResponse(apiResponse);

    localStorage.setItem("recommendations", JSON.stringify(recommendations));
    localStorage.setItem(
      "searchParams",
      JSON.stringify({
        brand,
        model,
        userNeed,
        minPrice,
        maxPrice,
        quality,
      })
    );

    window.location.href = "final.html";
  } catch (error) {
    displayErrorMessage(container, error.message);
  } finally {
    hideLoadingIndicator();
  }
}

// ==================== RECOMMENDATION DISPLAY ====================
function displayRecommendations() {
  const productList = document.getElementById("product-list");
  if (!productList) return;

  productList.innerHTML = "";

  try {
    const storedData = localStorage.getItem("recommendations");
    const searchParams = JSON.parse(
      localStorage.getItem("searchParams") || "{}"
    );

    if (!storedData) {
      throw new Error("No recommendations found. Please start a new search.");
    }

    const recommendations = JSON.parse(storedData);
    const productsFound = recommendations.length;

    if (productsFound === 0) {
      throw new Error("No products available for your search criteria.");
    }

    // Add results count display
    const resultsCount = document.createElement("div");
    resultsCount.className = "results-count";
    resultsCount.textContent = `Found ${productsFound} best matching product${
      productsFound !== 1 ? "s" : ""
    }`;
    productList.appendChild(resultsCount);

    // Create recommendation cards
    recommendations.forEach((product, index) => {
      const productCard = document.createElement("div");
      productCard.className = "product-card";
      productCard.innerHTML = `
        <div class="product-badge">${
          products[searchParams.userNeed]?.name || "Recommended"
        }</div>
        <h3>${product.name}</h3>
        ${product.specs ? `<p class="specs">${product.specs}</p>` : ""}
        <p class="price">${
          product.price || `₹${searchParams.minPrice}-₹${searchParams.maxPrice}`
        }</p>
        ${
          product.compatibility
            ? `<p class="compatibility">${product.compatibility}</p>`
            : ""
        }
        <p class="reason">${
          product.reason || "Compatible with your laptop model"
        }</p>
        <div class="product-actions ${
          product.amazon !== "#" || product.flipkart !== "#"
            ? "has-buttons"
            : ""
        }">
          ${
            product.amazon !== "#"
              ? `
            <button class="buy-button ${
              product.inStock ? "amazon-button" : "out-of-stock-button"
            }" 
              onclick="${
                product.inStock
                  ? `window.open('${product.amazon}', '_blank')`
                  : "return false"
              }" 
              ${product.inStock ? "" : "disabled"}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
              </svg>
              ${product.inStock ? "Amazon" : "Out of Stock"}
            </button>
          `
              : ""
          }
          ${
            product.flipkart !== "#"
              ? `
            <button class="buy-button ${
              product.inStock ? "flipkart-button" : "out-of-stock-button"
            }" 
              onclick="${
                product.inStock
                  ? `window.open('${product.flipkart}', '_blank')`
                  : "return false"
              }" 
              ${product.inStock ? "" : "disabled"}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
              </svg>
              ${product.inStock ? "Flipkart" : "Out of Stock"}
            </button>
          `
              : ""
          }
          ${
            (product.amazon === "#" || !product.inStock) &&
            (product.flipkart === "#" || !product.inStock)
              ? `
            <div class="no-stock-message">
              Currently out of stock on all platforms
            </div>
          `
              : ""
          }
        </div>
      `;
      productList.appendChild(productCard);
    });

    // Show search parameters
    if (searchParams.model) {
      const header = document.querySelector(".recommendation-container h2");
      if (header) {
        header.insertAdjacentHTML(
          "afterend",
          `
          <p class="search-summary">
            Showing results for <strong>${searchParams.brand} ${
            searchParams.model
          }</strong> | 
            Budget: ₹${searchParams.minPrice}-₹${searchParams.maxPrice} | 
            Quality: ${searchParams.quality === "high" ? "High" : "Standard"}
          </p>
        `
        );
      }
    }
  } catch (error) {
    productList.innerHTML = `
      <div class="error-message">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e74c3c">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <h3>Oops! Something went wrong</h3>
          <p>${error.message}</p>
          <button onclick="window.location.href='select.html'" class="retry-button">
            Try Again
          </button>
        </div>
      </div>
    `;
  }
}

// ==================== INITIALIZATION ====================
function initializePage() {
  // Set selected product from localStorage if available
  const storedProduct = localStorage.getItem("selectedProduct");
  if (storedProduct) {
    const dropdown = document.getElementById("drop");
    if (dropdown) dropdown.value = storedProduct;
    localStorage.removeItem("selectedProduct");
  }

  // Setup form submission
  const form = document.getElementById("preferencesForm");
  if (form) {
    form.addEventListener("submit", handleFormSubmit);
  }

  // Setup search functionality
  setupSearch();

  // Setup navigation
  setupNavigation();

  // Display recommendations on final page
  if (window.location.pathname.endsWith("final.html")) {
    displayRecommendations();
  }
}

// Make setUserNeed available globally
window.setUserNeed = function (category) {
  localStorage.setItem("selectedProduct", category);
  window.location.href = "/select.html";
};

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initializePage);
