require("dotenv").config();
const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const fs = require("fs");

const PORT = process.env.PORT || 3000;

const app = express();

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static("public"));

var pool = mysql.createPool({
  connectionLimit: 10,
  host: "localhost",
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});

let allCategories = [];

app.get("/", (req, res) => {
  if (allCategories.length === 0) {
    (async () => {
      try {
        const [rows, fields] = await pool
          .promise()
          .query("SELECT name FROM categories");
        allCategories = rows;
        allCategories.sort();
        req.app.locals.categories = allCategories;
      } catch (error) {
        console.log(error);
      }
    })().then(() => {
      res.render("home", { categories: allCategories });
    });
  } else {
    res.render("home", { categories: allCategories });
  }
});

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
      res.send({ message: "success" });
    })
    .catch((err) => {
      console.log(err);
      res.send({ message: "failed" });
    });
});

app.get("/shop", async (req, res) => {
  (async () => {
    try {
      const [rows, fields] = await pool
        .promise()
        .query("SELECT * FROM products");
      res.render("shop", { products: rows });
    } catch (error) {
      res.render("error");
    }
  })();
});

// app.get("/products", (req, res) => {
//     res.redirect("/products/1");
// });

app.get("/products", async (req, res) => {
  req.app.locals.categories = allCategories;
  (async () => {
    try {
      let pagination = [];
      const page = parseInt(req.query.page) || 1;
      const resultsPerPage = 15;
      const [rows, fields] = await pool
        .promise()
        .query("SELECT * FROM products");
      let pages = chunkArray(rows, resultsPerPage);
      let lowerBound = 1;
      let upperBound = 10;

      if (page < 1) {
        page = 1;
      } else if (page > pages.length) {
        page = page.length;
      }
      if (page > 6) {
        lowerBound = page - 5;
        upperBound = page + 4;
        if (upperBound > pages.length - 5) {
          lowerBound = pages.length - 9;
          upperBound = pages.length;
        }
      } else {
        lowerBound = 1;
        upperBound = 10;
      }
      res.render("products", {
        products: pages[page - 1],
        pages: pages,
        lowerBound: lowerBound,
        upperBound: upperBound,
        lastPage: pages.length - 1,
      });
    } catch (error) {
      console.log(error.message);
    }
  })();
});

app.get("/products/categories", (req, res) => {
  req.app.locals.categories = allCategories;
  let categoryName = req.query.name;
  req.app.locals.selectedCategory = categoryName;
  (async () => {
    try {
      let page = parseInt(req.query.page) || 1;
      const resultsPerPage = 15;
      const [
        rows,
        fields,
      ] = await pool
        .promise()
        .query(
          "SELECT p.* FROM products p JOIN product_categories pc ON pc.upc = p.upc JOIN categories c ON c.category_id = pc.category_id WHERE c.name = ?",
          [categoryName]
        );
      let pages = chunkArray(rows, resultsPerPage);
      let lowerBound = 1;
      let upperBound = 10;

      if (page < 1) {
        page = 1;
      } else if (page > pages.length) {
        page = page.length;
      }
      if (page > 6) {
        lowerBound = page - 5;
        upperBound = page + 4;
        if (upperBound > pages.length - 5) {
          lowerBound = pages.length - 9;
          upperBound = pages.length;
        }
      } else {
        lowerBound = 1;
        upperBound = 10;
      }
      if (pages.length < 10) {
        lowerBound = 1;
        upperBound = pages.length;
      }
      res.render("products", {
        products: pages[page - 1],
        pages: pages,
        lowerBound: lowerBound,
        upperBound: upperBound,
        lastPage: pages.length,
      });
    } catch (error) {
      console.log(`From /products/categories: ${error.message}`);
    }
  })();
});

app.get("/query/:name", (req, res) => {
  pool.query(`SELECT * FROM ${req.params.name}`, function (
    error,
    results,
    fields
  ) {
    if (error) return error;
    res.send(results);
  });
});

app.listen(PORT, () => {
  console.log(`App is listening on port ${PORT}`);
});

// Functions
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
                  function(err, result) {
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

const randNumArray = (count, max) => {
  let numArray = [];
  for (var i = 0; i < count; i++) {
    numArray.push(Math.floor(Math.random() * max));
  }
  return numArray;
};

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

function chunkArray(myArray, chunk_size) {
  var arrayLength = myArray.length;
  var tempArray = [];

  for (index = 0; index < arrayLength; index += chunk_size) {
    myChunk = myArray.slice(index, index + chunk_size);
    // Do something if you want with the group
    tempArray.push(myChunk);
  }

  return tempArray;
}
