const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

//JWT
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' })
  }
  //bearer token
  const token = authorization.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yervfsu.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    //await client.connect();
    client.connect();

    const usersCollection = client.db('ass12').collection('users');
    const courseCollection = client.db('ass12').collection('course');
    const cartCollection = client.db('ass12').collection('carts');
    const paymentCollection = client.db('ass12').collection('payment');


    //JWT
    app.post('/jwt', (req, res) =>{
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: 60 * 60})
      res.send({token})
    })

    const verifyAdmin = async(req,res,next) =>{
      const email = req.decoded.email;
      const query = {email: email}
      const user = await usersCollection.findOne(query);
      if(user?.role !== 'admin'){
        return res.status(403).send({ error: true, message: 'forbidden message' });
      }
      next();
    }

    //USER API
    app.get('/ins', async (req, res) => {
      const result = await usersCollection.find({ role: 'instructor' }).toArray();
      res.send(result);
    });
    app.get('/history/:email', async (req, res) => {
      const email = req.params.email;
    
      try {
        const result = await paymentCollection.find({ email: email }).toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send('Error retrieving payment history');
      }
    });

    
    

    app.delete('/history/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await paymentCollection.deleteOne(query);
      res.send(result);
    })

    app.get('/users', verifyJWT, verifyAdmin,  async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email }
      const existingUser = await usersCollection.findOne(query)
      if (existingUser) {
        return res.send({ message: 'already exists' })
      }
      const result = await usersCollection.insertOne(user);
      res.send(result)
    })

    // //// admin verify
    app.get('/users/admin/:email', verifyJWT,  async (req, res) => {
      const email = req.params.email;

      // if (req.decoded.email !== email) {
      //   res.send({ admin: false })
      // }

      const query = { email: email }
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === 'admin' }
      res.send(result);
    })
    // instructor
    app.get('/users/ins/:email',   async (req, res) => {
      const email = req.params.email.toLowerCase();
      console.log({email})
    
      // if (req.decoded.email !== email) {
      //   res.send({ instructor: false });
      // }
    
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      console.log(user)
      const result = { instructor: user?.role === 'instructor' };
      res.send(result);
    });


    // make admin
    app.patch('/users/admin/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: "admin"
        }
      }

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })
    // ins
    app.patch('/users/ins/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: "instructor"
        }
      }

      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

    


    //add
    app.post('/course', async (req, res) => {
      const newCourse = req.body;

      const result = await courseCollection.insertOne(newCourse);
      res.send(result);
    })

    app.get('/course', async (req, res) => {
      const cursor = courseCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })
    app.delete('/course/:id', verifyJWT, verifyAdmin, async (req, res) =>{
      const id = req.params.id;
      const query = { _id: new ObjectId(id)}
      const result = await courseCollection.deleteOne(query)
      res.send(result);    
   })

   // for ins 
   app.get('/course/:email', async (req, res) => {
    const email = req.params.email;
  
    try {
      const result = await courseCollection.find({ email: email }).toArray();
      res.send(result);
    } catch (error) {
      console.error(error);
      res.status(500).send('Error retrieving course data');
    }
  });


    // cart collection
    app.post('/carts', async (req, res) => {
      const item = req.body;
      console.log(item)
      const result = await cartCollection.insertOne(item)
      res.send(result)
    })



    app.get('/carts', verifyJWT, async (req, res) => {
      const email = req.query.email;
      console.log(email)
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res.status(401).send({ error: true, message: 'unauthorized access' })
      }

      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })

    //payment
    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    // payments api
    app.post('/payments', verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);

      const query = { _id: { $in: payment.cartItems.map(id => new ObjectId(id)) } }
      const deleteResult = await cartCollection.deleteMany(query)

      res.send({ insertResult, deleteResult });
    })

    app.get('/admin-stats', verifyJWT, verifyAdmin, async (req, res) => {
      const users = await usersCollection.estimatedDocumentCount();
      const products = await cartCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();

      

      const payments = await paymentCollection.find().toArray();
      const revenue = payments.reduce( ( sum, payment) => sum + payment.price, 0)

      res.send({
        revenue,
        users,
        products,
        orders
      })
    })

    app.get('/order-stats', verifyJWT, verifyAdmin, async(req, res) =>{
      const pipeline = [
        {
          $lookup: {
            from: 'menu',
            localField: 'menuItems',
            foreignField: '_id',
            as: 'menuItemsData'
          }
        },
        {
          $unwind: '$menuItemsData'
        },
        {
          $group: {
            _id: '$menuItemsData.category',
            count: { $sum: 1 },
            total: { $sum: '$menuItemsData.price' }
          }
        },
        {
          $project: {
            category: '$_id',
            count: 1,
            total: { $round: ['$total', 2] },
            _id: 0
          }
        }
      ];

      const result = await paymentCollection.aggregate(pipeline).toArray()
      res.send(result)

    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('server is running')
})

app.listen(port, () => {
  console.log(`server is running on port ${port}`)
})

