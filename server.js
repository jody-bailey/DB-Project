require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql");
const mysql2 = require("mysql2");
const util = require("util");
const fs = require("fs");
const PORT = process.env.PORT || 3000;

const app = express();

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static("public"));

const pool = mysql2.createPool({
  host: "localhost",
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

config = {
  host: "localhost",
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
};

function makeDb(config) {
  const connection = mysql.createConnection(config);
  return {
    query(sql, args) {
      return util.promisify(connection.query).call(connection, sql, args);
    },
    close() {
      return util.promisify(connection.end).call(connection);
    },
  };
}

const db = makeDb(config);

const randNumArray = (count, max) => {
  let numArray = [];
  for (var i = 0; i < count; i++) {
    numArray.push(Math.floor(Math.random() * max));
  }
  return numArray;
};

// HOME ROUTE
app.get("/", (req, res) => {
  res.render("home", { success: null, message: null });
});

// USE THIS ROUTE TO SEED THE DATABASE WITH THE PROVIDED DATA
app.get("/seeddb", async (req, res) => {
  (async () => {
    await seedProducts();
    await seedStores();
    await seedVendors();
    await seedCustomers();
    await seedStatusId();
    await seedVendorProducts();
    await seedStoreProducts();
    await seedCustomerOrders();
  })()
    .then(() => {
      res.render("home", {
        success: true,
        message: "Successfully seeded the database.",
      });
    })
    .catch((err) => {
      console.log(err);
      res.render("home", {
        success: false,
        message: "Failed to seed the database.",
      });
    });
});

// RENDERS THE "QUERIES" PAGE
app.get("/queries", async (req, res) => {
  res.render("queries");
});

// EXECUTES AND RETURNS THE TOP 20 PRODUCTS FROM EACH STORE QUERY
app.get("/queries/top-20-products-by-store", (req, res) => {
  getTopProductsByStore(req, res);
});

// EXECUTES AND RETURNS THE TOP 20 PRODUCTS BY STATE QUERY
app.get("/queries/top-20-products-by-state", (req, res) => {
  getTopProductsByState(req, res);
});

// EXECUTES AND RETURNS THE TOP 5 STORES BY SALES
app.get("/queries/top-5-stores", (req, res) => {
  getTop5Stores(req, res);
});

// EXECUTES AND RETURNS THE NUMBER OF STORES HP OUTSELLS LENOVO
app.get("/queries/hp-outsell-lenovo", (req, res) => {
  hpOutsellLevnovo(req, res);
});

// EXECUTES AND RETURNS THE TOP 3 CATEGORIES QUERY
app.get("/queries/top-3-categories", (req, res) => {
  getTopThreeCategories(req, res);
});

// STARTS THE SERVER
app.listen(PORT, () => {
  console.log(`App is listening on port ${PORT}`);
});

// DATABASE ACCESS - NORMALLY WOULD MODULATE THIS BUT DON'T HAVE TIME

// METHOD I FOUND ON STACKOVERFLOW TO SHUFFLE AN ARRAY. USED TO GENERATE SOME RANDOMNESS.
function shuffle(array) {
  var currentIndex = array.length,
    temporaryValue,
    randomIndex;

  while (0 !== currentIndex) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

// GETS THE STORE IDs FROM THE STORES TABLE
const getStoreIds = async () => {
  try {
    const result = await db.query("SELECT store_id FROM stores");
    return result;
  } catch (error) {
    console.log(error);
  }
};

// GETS THE STATES THAT HAVE STORES RESIDING IN THEM
const getStoreStates = async () => {
  const result = await db.query("SELECT distinct state FROM stores");

  return result;
};

// GETS THE TOP 20 PRODUCTS BY STORE
async function getTopProductsByStore(req, res) {
  try {
    let storeIds = await getStoreIds();
    let results = await asyncStoreProducts(storeIds);
    res.render("top20perStore", {
      products: results,
      numResults: results.length,
    });
  } catch (error) {
    console.log(error);
  }
}

// HELPER FOR THE ABOVE FUNCTION
const asyncStoreProducts = async (storeIds) => {
  let topProducts = [];
  for (const store of storeIds) {
    const result = await db.query(
      `select co.store_id, cop.upc, p.name, sum(quantity) as totalSold
        from customer_orders co
        join customer_order_products cop
          on cop.order_id = co.order_id
        join products p
          on p.upc = cop.upc
        where co.store_id = ?
        group by cop.upc, p.name
        order by co.store_id, sum(quantity) desc
        limit 20;`,
      store.store_id
    );
    for (const res of result) {
      topProducts.push(res);
    }
  }

  return topProducts;
};

// GET THE TOP PRODUCTS BY STATE
const getTopProductsByState = async (req, res) => {
  let topProducts = [];

  try {
    const states = await getStoreStates();
    const products = await getStoreProductsByState(states);

    res.render("top20byState", {
      products: products,
      numResults: products.length,
    });
  } catch (error) {
    console.log(error);
  }
};

// GETS PRODUCTS BY STATE
const getStoreProductsByState = async (states) => {
  let topProducts = [];
  for (const state of states) {
    const result = await db.query(
      `select s.state, co.store_id, cop.upc, p.name, sum(quantity) as totalSold
        from stores s 
        join customer_orders co
          on s.store_id = co.store_id
        join customer_order_products cop
          on cop.order_id = co.order_id
        join products p
          on p.upc = cop.upc
        where s.state = ?
        group by s.state, co.store_id, cop.upc, p.name
        order by sum(quantity) desc
        limit 20;`,
      state.state
    );

    for (const res of result) {
      topProducts.push(res);
    }
  }
  return topProducts;
};

// GETS THE TOP 5 STORES BASED ON SALES
const getTop5Stores = async (req, res) => {
  let topStores = [];

  const result = await db.query(
    `select store_id, count(*) as numSales
  from customer_orders
  where year(order_date) = year(current_date())
  group by store_id
  order by count(*) desc
  LIMIT 5;`
  );

  for (const res of result) {
    topStores.push(res);
  }

  res.render("top5StoreSales", { products: topStores });
};

// GET THE NUMBER OF STORES THAT HP OUTSELLS LENOVO
const hpOutsellLevnovo = async (req, res) => {
  try {
    let winners = [];
    const result = await db.query(`select s.store_id, sum(hp.totalSold) as hpSales, sum(lenovo.totalSold) as lenovoSales
    from stores s 
    join (select co.store_id as store_id, 
        cop.quantity as totalSold
        from customer_order_products cop
        join customer_orders co
          on co.order_id = cop.order_id
        join product_categories pc
          on pc.upc = cop.upc
        join categories c
          on c.category_id = pc.category_id
        join products p 
          on p.upc = cop.upc
        where c.name = 'Laptops'
        and p.brand = 'HP') as hp
        on hp.store_id = s.store_id
    join (select co.store_id as store_id, 
        cop.quantity as totalSold
        from customer_order_products cop
        join customer_orders co
          on co.order_id = cop.order_id
        join product_categories pc
          on pc.upc = cop.upc
        join categories c
          on c.category_id = pc.category_id
        join products p 
          on p.upc = cop.upc
        where c.name = 'Laptops'
        and p.brand = 'Lenovo') as lenovo
        on lenovo.store_id = s.store_id
    group by s.store_id
    order by s.store_id;`);

    for (const res of result) {
      winners.push({
        storeId: res.store_id,
        HP: res.hpSales,
        Lenovo: res.lenovoSales,
        winner: res.hpSales > res.lenovoSales ? "HP" : "Lenovo",
      });
    }

    let countHP = winners.filter((el) => el.winner === "HP");

    res.render("hpOutsellLenovo", {
      sales: winners,
      totalStores: countHP.length,
    });
  } catch (error) {
    console.log(error);
  }
};

// GETS THE TOP 3 CATEGORIES
const getTopThreeCategories = async (req, res) => {
  try {
    const result = await db.query(`select c.name, sum(quantity) as totalSold
    from customer_order_products cop
    join product_categories pc
      on pc.upc = cop.upc
    join categories c
      on c.category_id = pc.category_id
    where c.name <> 'Best Buy'
    group by c.name
    order by sum(quantity) desc
    limit 3;`);

    res.render("topThreeCategories", { categories: result });
  } catch (error) {
    console.log(error);
  }
};

// Seed Functions
const seedProducts = async () => {
  (async () => {
    try {
      const [rows, fields] = await pool
        .promise()
        .query("SELECT * FROM products");
      if (rows.length > 0) {
        console.log("Product data already exists.");
        return;
      }
    } catch (error) {
      console.log(error.message);
    }
  })();
  fs.readFile("./products.json", async (err, data) => {
    if (err) throw err;
    let products = JSON.parse(data);
    (async () => {
      products.forEach(async (product) => {
        let upc = product.upc;
        let name = product.name;
        let description = product.shortDescription;
        let brand = product.manufacturer;
        let price = product.regularPrice;
        let includedItems = product.includedItemList;
        let categories = product.categoryPath;
        (async () => {
          try {
            await pool
              .promise()
              .query(
                "INSERT IGNORE INTO products (upc, name, description, brand, price) VALUES (?, ?, ?, ?, ?)",
                [upc, name, description, brand, price]
              );
            includedItems.forEach(async (item) => {
              await pool
                .promise()
                .query(
                  "INSERT IGNORE INTO included_items (upc, item_name) VALUES (?, ?)",
                  [upc, item.includedItem]
                );
            });

            categories.forEach(async (cat) => {
              await pool
                .promise()
                .query("INSERT IGNORE INTO categories (name) VALUES (?)", [
                  cat.name,
                ]);
              await pool
                .promise()
                .query(
                  "INSERT IGNORE INTO product_categories (upc, category_id) VALUES (?, (SELECT category_id FROM categories WHERE name = ?))",
                  [upc, cat.name]
                );
            });
          } catch (error) {
            console.log(error.message);
          }
        })();
      });
    })();
  });
};

const seedStores = async () => {
  (async () => {
    try {
      const [rows, fields] = await pool.promise().query("SELECT * FROM stores");
      if (rows.length > 0) {
        console.log("Store data already exists.");
        return;
      }
    } catch (error) {
      console.log(error.message);
    }
  })();
  fs.readFile("./stores.json", async (err, data) => {
    if (err) throw err;
    let stores = JSON.parse(data);
    (async () => {
      stores.forEach(async (store) => {
        let add_1 = store.address;
        let add_2 = store.address2;
        let city = store.city;
        let state = store.region;
        let zip = store.fullPostalCode;
        let country = store.country;
        let name = store.name;
        let phone = store.phone;
        let storeId = store.storeId;

        (async () => {
          try {
            await pool
              .promise()
              .query(
                "INSERT IGNORE INTO stores (store_id, phone, add_1, add_2, city, state, zip, country, hrs_open, hrs_close) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '09:00:00', '22:00:00')",
                [storeId, phone, add_1, add_2, city, state, zip, country]
              );
          } catch (error) {
            console.log(error.message);
          }
        })();
      });
    })();
  });
};

const seedVendors = async () => {
  (async () => {
    try {
      const [rows, fields] = await pool
        .promise()
        .query("SELECT * FROM vendors");
      if (rows.length > 0) {
        console.log("Vendor data already exists.");
        return;
      }
    } catch (error) {
      console.log(error.message);
    }
  })();
  fs.readFile("./vendors.json", async (err, data) => {
    if (err) throw err;
    let vendors = JSON.parse(data);
    (async () => {
      vendors.forEach(async (vendor) => {
        let name = vendor.name;
        let phone = vendor.phone;
        let add_1 = vendor.add_1;
        let add_2 = vendor.add_2;
        let city = vendor.city;
        let state = vendor.state;
        let zip = vendor.zip;
        let country = vendor.country;

        try {
          await pool
            .promise()
            .query(
              "INSERT IGNORE INTO vendors (name, phone, add_1, add_2, city, state, zip, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
              [name, phone, add_1, add_2, city, state, zip, country]
            );
        } catch (error) {
          console.log(error.message);
        }
      });
    })();
  });
};

const seedCustomers = async () => {
  (async () => {
    try {
      const [rows, fields] = await pool
        .promise()
        .query("SELECT * FROM customers");
      if (rows.length > 0) {
        console.log("Customer data already exists.");
        return;
      }
    } catch (error) {
      console.log(error.message);
    }
  })();
  fs.readFile("./customers.json", async (err, data) => {
    if (err) throw err;
    let customers = JSON.parse(data);
    (async () => {
      customers.forEach(async (customer) => {
        let firstName = customer.first_name;
        let lastName = customer.last_name;
        let email = customer.email;
        let phone = customer.phone;
        let add_1 = customer.add_1;
        let add_2 = customer.add_2;
        let city = customer.city;
        let state = customer.state;
        let zip = customer.zip;
        let country = customer.country;

        try {
          await pool
            .promise()
            .query(
              "INSERT IGNORE INTO customers (first_name, last_name, email, phone, add_1, add_2, city, state, zip, country) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [
                firstName,
                lastName,
                email,
                phone,
                add_1,
                add_2,
                city,
                state,
                zip,
                country,
              ]
            );
        } catch (error) {
          console.log(error.message);
        }
      });
    })();
  });
};

const seedStatusId = async () => {
  (async () => {
    try {
      const [rows, fields] = await pool
        .promise()
        .query("SELECT * FROM order_status");
      if (rows.length > 0) {
        console.log("Order status data already exists.");
        return;
      }
    } catch (error) {
      console.log(error.message);
    }
  })();
  fs.readFile("./orderStatus.json", async (err, data) => {
    if (err) throw err;
    let statuses = JSON.parse(data);
    statuses.forEach(async (entry) => {
      let name = entry.status;

      try {
        await pool
          .promise()
          .query("INSERT IGNORE INTO order_status (status) VALUES (?)", [name]);
      } catch (error) {
        console.log(error.message);
      }
    });
  });
};

const seedVendorProducts = async () => {
  (async () => {
    try {
      const [rows, fields] = await pool
        .promise()
        .query("SELECT * FROM vendor_products");
      if (rows.length > 0) {
        console.log("Vendor product data already exists.");
        return;
      }
    } catch (error) {
      console.log(error.message);
    }
  })();
  (async () => {
    try {
      const [rows1, fields1] = await pool
        .promise()
        .query("SELECT * FROM vendors");
      let vendors = rows1;
      const [rows2, fields2] = await pool
        .promise()
        .query("SELECT * FROM products");
      let products = shuffle(rows2);
      products.forEach(async (product) => {
        let upc = product.upc;
        let quantity = Math.floor(Math.random() * 500);
        let price = product.price * 0.9;
        let numVendors = Math.floor(1 + Math.random() * 3);
        vendors = shuffle(vendors);
        for (var i = 0; i < numVendors; i++) {
          let vendorId = vendors[i].vendor_id;
          await pool
            .promise()
            .query(
              "INSERT IGNORE INTO vendor_products (vendor_id, upc, quantity, price) VALUES (?, ?, ?, ?)",
              [vendorId, upc, quantity, price]
            );
        }
      });
    } catch (error) {
      console.log(error.message);
    }
  })();
};

const seedStoreProducts = async () => {
  (async () => {
    try {
      const [rows, fields] = await pool
        .promise()
        .query("SELECT * FROM store_products");
      if (rows.length > 0) {
        console.log("Store products data already exists.");
        return;
      }
    } catch (error) {
      console.log(error.message);
    }
  })();
  (async () => {
    try {
      const [rows1, fields1] = await pool
        .promise()
        .query("SELECT * FROM stores");
      let stores = rows1;
      const [rows2, fields2] = await pool
        .promise()
        .query("SELECT * FROM products");
      let products = rows2;
      stores.forEach(async (store) => {
        let storeId = store.store_id;
        let numProducts = Math.floor(Math.random() * 200) + 400;
        products = shuffle(products);
        for (var i = 0; i < numProducts; i++) {
          let upc = products[i].upc;
          let quantity = Math.floor(Math.random() * 25);
          await pool
            .promise()
            .query(
              "INSERT IGNORE INTO store_products (store_id, upc, quantity) VALUES (?, ?, ?)",
              [storeId, upc, quantity]
            );
        }
      });
    } catch (error) {
      console.log(error.message);
    }
  })();
};

const seedCustomerOrders = async () => {
  (async () => {
    try {
      const [rows, fields] = await pool
        .promise()
        .query("SELECT * FROM customer_order_products");
      if (rows.length > 0) {
        console.log("Customer order products data already exists.");
        return;
      }
    } catch (error) {
      console.log(error.message);
    }
  })();
  (async () => {
    try {
      const [customers, fields1] = await pool
        .promise()
        .query("SELECT * FROM customers");
      const [products, fields2] = await pool
        .promise()
        .query("SELECT * FROM products");
      const [stores, fields3] = await pool
        .promise()
        .query("SELECT * FROM stores");
      const [statuses, fields4] = await pool
        .promise()
        .query("SELECT * FROM order_status");
      customers.forEach(async function (customer) {
        let numOrders = Math.floor(Math.random() * 5);
        if (numOrders > 0) {
          let randomProducts = [];
          randNumArray(numOrders, products.length).forEach(function (num) {
            randomProducts.push(products[num]);
          });
          let randomStore = stores[Math.floor(Math.random() * stores.length)];
          let randomStatus =
            statuses[Math.floor(Math.random() * statuses.length)];
          pool.query(
            "INSERT IGNORE INTO customer_orders (customer_id, store_id, order_date, status_id) values (?, ?, (SELECT NOW() - INTERVAL FLOOR(RAND() * 14) DAY), ?)",
            [
              customer.customer_id,
              randomStore.store_id,
              randomStatus.status_id,
            ],
            function (err, result) {
              if (err) throw err;
              randomProducts.forEach(async function (prod) {
                let quantity = Math.floor(Math.random() * 5) + 1;

                // Need to verify the store has the quantity ordered and deduct this quantity from the inventory
                pool.query(
                  "INSERT IGNORE INTO customer_order_products (order_id, upc, quantity, price) VALUES (?, ?, ?, ?)",
                  [result.insertId, prod.upc, quantity, prod.price],
                  function (err, result) {
                    if (err) throw err;
                  }
                );
              });
            }
          );
        }
      });
    } catch (error) {
      console.log(error.message);
    }
  })();
};
