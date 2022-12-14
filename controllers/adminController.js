const adminModel = require('../models/adminModel');
const product = require('../models/productModel');
const userModel = require('../models/userModel');
const bcrypt = require('bcrypt');
const categoryModel = require('../models/categoryModel');
const productModel = require('../models/productModel');
const orderModel = require("../models/orderModel");
const moment = require("moment");




module.exports = {

    //=============================================================================================
    //For view admin Page
    homeView: async(req, res) => {

        let allProducts = await productModel.find({}).countDocuments()
        let activeUsers = await userModel.find({}).countDocuments()
        let liveOrders = await orderModel.find({ orderStatus: { $nin: ["Delivered", "Cancelled"] } }).countDocuments()
        let newOrders = await orderModel.find().populate('products.productId').sort({date: -1 }).limit(5)
        let newUsers = await userModel.find({ type: "Active" }).sort({ join: -1 }).limit(5)

        let start = new Date();
        start.setHours(0, 0, 0, 0);
        let end = new Date();
        end.setHours(23, 59, 59, 999);
        let ordersToday = await orderModel.find({orderDate: {$gte: start, $lt: end}}).countDocuments()

        let online = await orderModel.aggregate([
            { '$match': { payment_method: 'Razorpay'}},
            { '$group': { '_id': null, 'subTotal': { '$sum': '$cartTotal' } } }
        ])
        let COD = await orderModel.aggregate([
            { '$match': { payment_method: 'COD'}},
            { '$group': { '_id': null, 'COD': { '$sum': '$cartTotal' } } }
        ])


        let sales = await orderModel.aggregate([
            {
                '$group': {
                    '_id': null,
                    'totalCount': {
                        '$sum': '$cartTotal'
                    }
                }
            }
        ])

      const totalSales = sales.map(a => a.totalCount)
      const onlinePayments = online.map(a => a.subTotal)
      const oflinePayments = COD.map(a => a.COD)


        res.render("admin/home", {allProducts,activeUsers,liveOrders,totalSales,newOrders,index:1,onlinePayments,oflinePayments,moment,INDEX:1,
        });
    },

    loginView: (req, res) => {
        res.render("admin/login",{})
    },
    //.............................................................................................
    //for login
    login: async (req, res) => {

        const { email, password } = req.body;
        const admin = await adminModel.findOne({ email });
        if (!admin) {
            return res.redirect('/admin');
        }
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return res.redirect('/admin');
        }
        req.session.adminLogin = true;
        req.session.admin = admin.adminName

        {
            res.redirect('/admin/home')
        }
    },
    
    // session middleware

    adminSession: (req,res,next)=>{
        if(req.session.adminLogin){
            next()
        }else{
            res.redirect('/admin')
        }
    },

    // ============================================================================================ 
    // view all user   
    allUserVIew: async (req, res) => {
        try{
        let users = await userModel.find()
        res.render("admin/allUser", { users, index: 1 })
        }catch{
            res.render(error)
        }
    },
    //............................................................................................
    //block user
    blockUser: async (req, res) => {
        const id = req.params.id
        await userModel.findByIdAndUpdate({ _id: id }, { $set: { status: "Blocked" } })
            .then(() => {
                res.redirect('/admin/allUser')
            })
    },
    //............................................................................................
    //unblock user
    unblockUser: async (req, res) => {
        const id = req.params.id
        await userModel.findByIdAndUpdate({ _id: id }, { $set: { status: "unBlocked" } })
            .then(() => {
                res.redirect('/admin/allUser')
            })
    },
    //================================================================================================
    //categoriesPage show admin
    categoriesPage: async (req, res) => {
        const category = await categoryModel.find({});
        res.render('admin/categoriesPage', { category, index: 1 })
    },
    //..............................................................................................
    //new category adding

    newCategory: async (req, res) => {
        const category = req.body.category;
        const newCategory = categoryModel({ category });
        newCategory.save().then(res.redirect('/admin/categoriesPage'))
    },

    //  const category = await categoryModel.find({categoryStatus:{$ne:"inactive"}});
    // ............................................................................................
    // deleteCategory
    deleteCategory: async (req, res) => {
        let id = req.params.id;
        await categoryModel.findByIdAndDelete({ _id: id });
        res.redirect('/admin/categoriesPage')
    },
    //............................................................................................
    // active and  in active category
    activeCategory: async (req, res) => {
        const id = req.params.id
        await categoryModel.findByIdAndUpdate({ _id: id }, { $set: { status: "active" } })
            .then(() => {
                res.redirect('/admin/categoriesPage')
            })
    },
    inActiveCategory: async (req, res) => {
        const id = req.params.id
        await categoryModel.findByIdAndUpdate({ _id: id }, { $set: { status: "inActive" } })
            .then(() => {
                res.redirect('/admin/categoriesPage')
            })
    },
    //================================================================================================
    //   addProductPage  and all productspage show page 
    addProductPage: async (req, res) => {
        // const category = await categoryModel.find({categoryStatus:{$eq:"active"}});
        const category = await categoryModel.find();
        res.render('admin/addProduct', { category })

    }, 
    allProductPage: async (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const items_per_page = 5;
        const totalproducts = await productModel.find().countDocuments()
        // console.log(totalproducts);
        const products = await productModel.find({}).populate('category').skip((page - 1) * items_per_page).limit(items_per_page)
        res.render('admin/allProduct', { products, index: 1, page,
            hasNextPage: items_per_page * page < totalproducts,
            hasPreviousPage: page > 1,
            PreviousPage: page - 1})
    },

    //................................................................................................
    //  create a newProduct

    newProduct: async (req, res) => {
        const { category, name, price, brand, description } = req.body
        const image = req.file;
        const newProduct = productModel({
            category,
            name,
            price,
            brand,
            description,
            image: image.filename,
        });
        await newProduct
            .save()
            .then(() => {
                res.redirect("/admin/addProductPage")
            })
            .catch((err) => {
                console.log(err.message);
            });

    },
    //.......................................................................................................
    //listProduct the admin side lilst and unlist
    listProduct: async (req, res) => {
        const id = req.params.id
        await productModel.findByIdAndUpdate({ _id: id }, { $set: { status: "list" } })
            .then(() => {
                res.redirect('/admin/allProductPage')
            })
    },
    unListProduct: async (req, res) => {
        const id = req.params.id
        await productModel.findByIdAndUpdate({ _id: id }, { $set: { status: "unlist" } })
            .then(() => {
                res.redirect('/admin/allProductPage')
            })
    },

    //==========================================================================================================
    //EDIT PRODUCT show page
    
    editProductPage : async (req,res)=> {
      const id=req.params.id
      const category =await categoryModel.find()
      let product = await productModel.findOne({_id:id}).populate('category','category') 
      res.render('admin/editProduct',{product,category})
    },

    editProduct : async (req,res,next) => {
        if(req.file){
            let image =req.file
            const {category,name,brand,description,price}=req.body
            await productModel.updateOne({_id: req.params.id},{$set: {category,name,brand,description,price,image:image.filename}})
            res.redirect('/admin/allProductPage')
        }
            
    },









    // ................................................................................
    //adminlogout
    logOut: (req, res) => {
        req.session.loggedOut = true;
        req.session.destroy()
        res.redirect('/admin')
    }
}