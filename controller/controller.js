var nodemailer = require('nodemailer');
var MongoClient = require('mongodb').MongoClient;
var bcrypt = require('bcrypt');

let url = "mongodb://localhost:27017";
let dbName = 'blog';
const client = new MongoClient(url,{useNewUrlParser:true});
let BCRYPT_SALT_ROUNDS = 12;

module.exports =
{
    getIndex: function(request,response,next)
    {
        if(request.session.username === undefined)
        {
            response.render('index',{notConnected: "Vous n'êtes pas connecté, veuillez vous connecté pour voir les articles"});
        }
        else
        {
            client.connect(function(err)
            {
                if(err) throw err;
                console.log("Connected to the database");

                const db = client.db(dbName);

                db.collection('articles').find({'visibility': "public"}).toArray(function (err,result) {
                    if (err) throw err;

                    if(result.length === 0 || result.length === undefined)
                    {
                        response.render('index',{noPublicArticle: "Aucun article public n'as été publié sur le blog", username: request.session.username, role: request.session.role})
                    }
                    else
                    {
                        response.render("index",{publicArticles:result, username: request.session.username, role: request.session.role});
                    }
                });
            });
        }
    },

    postIndex: function(request,response,next)
    {
        if(request.session.username === undefined)
        {
            response.render('index',{notConnected: "Vous n'êtes pas connecté, veuillez vous connecté pour voir les articles"});
        }
        else
        {
            var articleLiked = request.body.like.toString().slice(-1);

            // On recherche dans la BDD le nombre d'article

            client.connect(function(err)
            {
                if(err) throw err;
                console.log("Connected to the database");

                const db = client.db(dbName);

                db.collection('articles').find({'visibility': "public"}).toArray(function (err,result) {
                    if (err) throw err;

                    var titleArticleLiked = result[articleLiked].title;
                    var likedBy = result[articleLiked].likedBy;

                    if(likedBy.includes(request.session.username.toString()))
                    {
                        // Dislike

                        likedBy = likedBy.replace(request.session.username.toString() + ",","");

                        db.collection('articles').updateOne({"title": titleArticleLiked},{$set: {likedBy: likedBy}} , function(err)
                        {
                            if(err) throw err;
                        });

                        response.redirect("index");
                    }
                    else
                    {
                        // Like

                        likedBy += request.session.username + ",";

                        db.collection('articles').updateOne({"title": titleArticleLiked},{$set: {likedBy: likedBy}} , function(err)
                        {
                            if(err) throw err;
                        });

                        db.collection('articles').find({"title":titleArticleLiked}).toArray(function (err,result)
                        {
                            if(err) throw err;

                            var authorLikedArticle = "";
                            result.forEach(function(item)
                            {
                                authorLikedArticle = item.author;
                            });
                            console.log("Auteur : " + authorLikedArticle);

                            db.collection('user').find({username:authorLikedArticle}).toArray(function (err,result)
                            {
                                if(err) throw err;

                                var emailEntered = "";
                                result.forEach(function(item)
                                {
                                    emailEntered = item.email;
                                });

                                var transporter = nodemailer.createTransport(
                                    {
                                        service: "Gmail",
                                        auth:
                                            {
                                                user: "projet3webblog@gmail.com",
                                                pass: "Azertyuiop123*"
                                            }
                                    });
                                var mail =
                                    {
                                        from: "projet3webblog@gmail.com",
                                        to: emailEntered,
                                        subject: "Someone liked your article !",
                                        html: " " + request.session.username + " Just liked your article " + titleArticleLiked + " !"
                                    };

                                transporter.sendMail(mail, function (error)
                                {
                                    if(error)
                                    {
                                        console.log("Erreur lors de l'envoie du mail!");
                                        console.log(error);
                                    }
                                    else
                                    {
                                        console.log("Mail envoyé avec succès!")
                                    }
                                });
                            });
                        });
                        response.redirect("index");
                    }
                });
            });
        }
    },

    getLogin: function (request,response,next)
    {
        response.app.locals.errorRegister = "";
        if(request.session.username === undefined)
        {
            // Pas connecté
            response.render('login')
        }
        else
        {
            response.redirect("index")
        }
    },

    postLogin: function(request,response,next)
    {
        if(request.session.username === undefined)
        {
            let usernameEntered = request.body.user.username;
            client.connect(function(err)
            {
                if(err) throw err;
                console.log("Connected to the database");

                const db = client.db(dbName);

                db.collection('user').find({'username': usernameEntered}).toArray(function (err,result) {
                    if (err) throw err;

                    if(result.length === 0)
                    {
                        request.app.locals.errorLogin = "Nom d'utilisateur / mot de passe incorrect";
                        response.redirect("login")
                    }
                    else
                    {
                        var test = result.find(function (element)
                        {
                            if(bcrypt.compareSync(request.body.user.password,element.password))
                            {
                                request.session.username = usernameEntered;
                                if (element.role === "Administrateur")
                                {
                                    request.session.role = "Administrateur";
                                    response.redirect("pannelAdmin")
                                }
                                else
                                {
                                    request.session.role = "Utilisateur";
                                    response.redirect("index")
                                }
                            }
                            else
                            {
                                request.app.locals.errorLogin = "Nom d'utilisateur / mot de passe incorrect";
                                response.redirect("login")
                            }
                        });
                    }
                });
            });
        }
        else
        {
            // Connecté
            response.redirect("index");
        }
    },

    getRegister: function (request,response,next)
    {
        response.app.locals.successLogin = "";
        response.app.locals.errorLogin = "";
        response.app.locals.successRegister = "";

        if(request.session.username === undefined)
        {
            // Pas connecté
            response.render('register');
            next();
        }
        else
        {
            // Connecté
            response.redirect("index")
        }
    },

    postRegister: function (request,response,next)
    {
        if(request.session.username === undefined)
        {
            var usernameEntered = request.body.user.username;
            var passwordEntered = bcrypt.hashSync(request.body.user.password, BCRYPT_SALT_ROUNDS);
            var emailEntered = request.body.user.email;

            client.connect(function(err)
            {
                if(err) throw err;
                console.log("Connected to the database");

                const db = client.db(dbName);

                db.collection('user').find({'username': usernameEntered}).toArray(function (err,result) {
                    if (err) throw err;

                    if(result.length === 0)
                    {
                        db.collection('user').insertOne({username:usernameEntered,password:passwordEntered,email:emailEntered,role:"Utilisateur"}, function(err)
                        {
                            if(err) throw err;

                            else
                            {
                                var transporter = nodemailer.createTransport(
                        {
                                    service: "Gmail",
                                    auth:
                                    {
                                        user: "projet3webblog@gmail.com",
                                        pass: "Azertyuiop123*"
                                    }
                                });
                                console.log(emailEntered);
                                var mail =
                                {
                                    from: "projet3webblog@gmail.com",
                                    to: emailEntered,
                                    subject: "leSujetDuMail",
                                    html: "leCorpsDeVotreMessageEnHTML"
                                };

                                transporter.sendMail(mail, function (error)
                                {
                                    if(error)
                                    {
                                        console.log("Erreur lors de l'envoie du mail!");
                                        console.log(error);
                                    }
                                    else
                                    {
                                        console.log("Mail envoyé avec succès!")
                                    }
                                    transporter.close();
                                });

                                response.app.locals.successRegister = "Veuillez confirmer votre email avant de vous connecter";
                                response.redirect("login");
                            }
                        });
                    }
                    else
                    {
                        response.app.locals.errorRegister = "Nom d'utilisateur déjà pris";
                        response.redirect("register");
                    }
                });
            });
        }
        else
        {
            // Connecté
            response.redirect("index");
        }
    },

    getLogout: function(request,response,next)
    {
        if(request.session.username === undefined)
        {
            response.redirect('login')
        }
        else
        {
            request.session.username = undefined;
            request.session.password = undefined;
            request.session.role = undefined;
            request.app.locals.successLogin = "";
            request.app.locals.successRegister = "";
            request.app.locals.errorLogin = "";
            request.app.locals.registerError = "";
            response.app.locals.successLogin = "Deconnexion OK";
            response.redirect('login')
            // Déconnexion OK
        }
    },

    getPannelAdmin: function (request,response,next)
    {
        response.app.locals.successAddArticle = "";
        response.app.locals.errorAddArticle = "";
        request.app.locals.successLogin = "";
        request.app.locals.successRegister = "";
        request.app.locals.errorLogin = "";
        request.app.locals.registerError = "";
        if(request.session.role === "Administrateur" && request.session.username !== undefined)
        {
            client.connect(function(err)
            {
                if(err) throw err;
                console.log("Connected to the database");

                const db = client.db(dbName);

                db.collection('articles').find().toArray(function (err,result) {
                    if (err) throw err;

                    if(result.length === 0 || result.length === undefined)
                    {
                        response.app.locals.errorListArticle = "Aucun article dans la base de données";
                        response.render("pannelAdmin");
                    }
                    else
                    {
                        response.render("pannelAdmin",{articles:result});
                    }
                });
            });
        }
        else
        {
            response.status(401).send();
        }
    },

    getAddArticle: function (request,response,next)
    {
        response.app.locals.deleteSucessfull = "";
        response.app.locals.errorListArticle = "";
        request.app.locals.successLogin = "";
        request.app.locals.successRegister = "";
        request.app.locals.errorLogin = "";
        request.app.locals.registerError = "";
        if(request.session.role === "Administrateur" && request.session.username !== undefined)
        {
            response.render("Add")
        }
        else
        {
            response.status(401).send();
        }
    },

    postAddArticle: function(request,response,next)
    {
        var title = request.body.article.title;
        var content = request.body.article.content;
        var visibility = request.body.article.visibility;

        // var article = new Article(title,content,request.session.username,Date());

        client.connect(function(err)
        {
            if(err) throw err;
            console.log("Connected to the database");

            const db = client.db(dbName);

            db.collection('articles').find({'title': title}).toArray(function (err,result) {
                if (err) throw err;

                if(result.length === 0 || result.length === undefined)
                {
                    var creationDate = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
                    db.collection('articles').insertOne({title:title, author:request.session.username, content:content, creationDate:creationDate, visibility: visibility, likedBy:""}, function(err)
                    {
                        if(err) throw err;
                        else
                        {
                            response.app.locals.successAddArticle = "Article ajouté en BDD";
                            response.redirect("/pannelAdmin");
                        }
                    });
                }
                else
                {
                    response.app.locals.errorAddArticle = "Erreur lors de l'ajout de l'article, titre déjà pris";
                    response.render("Add");
                }
            });
        });
    },

    getUpdateArticle: function (request,response,next)
    {
        response.app.locals.deleteSucessfull = "";
        response.app.locals.errorListArticle = "";
        response.app.locals.successAddArticle = "";
        response.app.locals.errorAddArticle = "";
        request.app.locals.successLogin = "";
        request.app.locals.successRegister = "";
        request.app.locals.errorLogin = "";
        request.app.locals.registerError = "";
        if(request.session.role === "Administrateur" && request.session.username !== undefined)
        {
            response.render("Update")
        }
        else
        {
            response.status(401).send();
        }
    },

    postUpdateArticle: function(request,response,next)
    {
        if(request.session.role === "Administrateur" && request.session.username !== undefined)
        {
            client.connect(function(err)
            {
                if(err) throw err;
                console.log("Connected to the database");

                const db = client.db(dbName);

                db.collection('articles').find({title: request.body.articleToUpdate.title}).toArray(function (err,result)
                {
                    if (err) throw err;

                    if(result.length === 0 || result.length === undefined)
                    {
                        response.render("Update",{noArticleToUpdate: "Aucun article avec ce nom n'a été publié, impossible de mettre à jour"})
                    }
                    else
                    {
                        var newTitle = request.body.articleToUpdate.newTitle !== "" ? request.body.articleToUpdate.newTitle : request.body.articleToUpdate.title;
                        var newContent = request.body.articleToUpdate.newContent;
                        var newVisibility = request.body.articleToUpdate.newVisibility;

                        if((newContent !== undefined && newVisibility !== undefined) && (newContent !== "" && newVisibility !== ""))
                        {
                            db.collection('articles').updateOne({"title": request.body.articleToUpdate.title},{$set: {"title": newTitle, "content": newContent, "visibility": newVisibility}},function (err,result) {
                                if(err) throw err;
                            });
                        }
                        else if(newContent !== undefined && newContent !== "")
                        {
                            db.collection('articles').updateOne({"title": request.body.articleToUpdate.title}, {$set: {"title": newTitle, "content": newContent}});
                        }
                        else if(newVisibility !== undefined && newVisibility !== "")
                        {
                            db.collection('articles').updateOne({"title": request.body.articleToUpdate.title},{$set: {"title": newTitle, "visibility": newVisibility}});
                        }
                        else
                        {
                            console.log("Aucune modification");
                        }

                        db.collection('articles').find({title: newTitle}).toArray(function (err,newArticle)
                        {
                            if (err) throw err;
                            response.render("Update",{oldArticle:result, newArticle:newArticle})
                        });
                    }
                });
            });
        }
        else
        {
            response.status(401).send();
        }
    },

    getDeleteArticle: function (request,response,next)
    {
        response.app.locals.errorListArticle = "";
        response.app.locals.successAddArticle = "";
        response.app.locals.errorAddArticle = "";
        request.app.locals.successLogin = "";
        request.app.locals.successRegister = "";
        request.app.locals.errorLogin = "";
        request.app.locals.registerError = "";
        if(request.session.role === "Administrateur" && request.session.username !== undefined)
        {
            response.render("Delete")
        }
        else
        {
            response.status(401).send();
        }
    },

    postDeleteArticle: function(request,response,next)
    {
        if(request.session.role === "Administrateur" && request.session.username !== undefined)
        {
            client.connect(function(err)
            {
                if(err) throw err;
                console.log("Connected to the database");

                const db = client.db(dbName);

                db.collection('articles').deleteOne({"title": request.body.articleToDelete.title}, function (err) {
                    if(err) throw err;
                })
            });
            response.app.locals.deleteSucessfull = "Delete de l'article " + request.body.articleToDelete.title + " effectué";
            response.redirect("/pannelAdmin")
        }
        else
        {
            response.status(401).send();
        }
    }
};