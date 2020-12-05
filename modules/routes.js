const express = require("express");

const router = express.Router();
const passport = require("passport");
const { serializeError, deserializeError } = require("serialize-error");
const async = require("async");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const moment = require("jalali-moment");
const config = require("./config");
const Customer = require("../models/Customers");
const Reception = require("../models/Reception");
const User = require("../models/User");
/**---------------------------------------------------------
 * !Global Variables
 */
// status of receptions
const Status = {
  doing: "doing",
  rejected: "rejected",
  canceled: "canceled",
  dalayed: "dalayed",
  succeded: "succeded",
  returned: "returned",
};

/**---------------------------------------------------------
 * !Helper Methods
 */
const translateStatustoFarsi = (status) => {
  if (status === "doing") return "در حال انجام";
  if (status === "rejected") return "نا موفق";
  if (status === "canceled") return "کنسلی";
  if (status === "dalayed") return "با تاخیر";
  if (status === "succeded") return "تحویل موفق";
  if (status === "returned") return "برگشتی";
  return "خطا";
};
const elaspedDays = (d) => {
  const date = new Date(d);
  const miliseconds = Date.now() - date;
  const days = miliseconds / (1000 * 60 * 60 * 24);
  return days;
};
const addCustomerInfoToReception = async (rs) => {
  const receptions = [];
  await Promise.all(
    rs.map(async (reception) => {
      // reception Data-time to Jalali
      const date = new Date(reception.reception_id);
      const dateTime = new Intl.DateTimeFormat("en-US").format(date);
      // get jalali data (https://www.npmjs.com/package/jalali-moment)
      const m = moment.from(dateTime, "en", "MM/DD/YYYY");
      const jDate = m.format("jYYYY/jMM/jDD");
      // makeing 2 digit hour and minute
      const time = `${(date.getHours() < 10 ? "0" : "") + date.getHours()}:${
        (date.getMinutes() < 10 ? "0" : "") + date.getMinutes()
      }`;
      reception.date = jDate;
      reception.time = time;
      // reception status
      reception.status = translateStatustoFarsi(reception.status);
      await Customer.findOne({ phoneNumber: reception.customerPhoneNumber })
        .then((customer) => {
          reception.customerName = customer.name;
          reception.customerLastname = customer.lastName;
          receptions.push(reception);
        })
        .catch((err) => {
          console.log("Customer.findone:", serializeError(err).message);
        });
    })
  );
  return receptions;
};
// checks if user is exist and logged in?
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash("error", "شما مجاز نیستید");
  return res.redirect("/login");
};
// check if user logged before
const isSaved = (req, res, next) => {
  if (req.isAuthenticated()) {
    return res.redirect("/dashboard");
  }
  return next();
};

const isToday = (d) => {
  const date = new Date(d);
  const today = new Date();
  return (
    today.getDate() === date.getDate() &&
    today.getMonth() === date.getMonth() &&
    today.getFullYear === date.getFullYear
  );
};

/**---------------------------------------------------------
 * ?Routes
 * !GETs
 */
router.get("/", (_req, res) => {
  // debugger;
  res.render("index");
});
router.get("/dashboard", isAuthenticated, async (req, res) => {
  let totalReceptions = 0;
  let todayTotalReceptions = 0;
  let doingCount = 0;
  let rejectedCount = 0;
  let returnedCount = 0;
  let returnedTodayCount = 0;
  let canceledCount = 0;
  delayedCount = 0;
  let succededCount = 0;
  await Reception.find({}).then((receptions) => {
    totalReceptions = receptions.length;

    // loop all receptions
    for (const reception of receptions) {
      // check dates(reception_id)
      if (isToday(reception.reception_id)) {
        todayTotalReceptions++;
        returnedTodayCount++;
      }
      // check Status
      if (reception.status === "doing") {
        doingCount++;
      }
      if (reception.status === "rejected") {
        rejectedCount++;
      }
      if (reception.status === "canceled") {
        canceledCount++;
      }
      if (
        elaspedDays(reception.reception_id) > config.DELAY_CRITERIA &&
        reception.status == Status.doing
      ) {
        delayedCount++;
      }
      if (reception.status === "succeded") {
        succededCount++;
      }
      if (reception.status === "returned") {
        returnedCount++;
      }
    }
  });
  res.render("dashboard", {
    name: req.user.name,
    totalReceptions,
    todayTotalReceptions,
    doingCount,
    rejectedCount,
    canceledCount,
    delayedCount,
    succededCount,
    returnedCount,
  });
});
router.get("/login", isSaved, (_req, res) => {
  res.render("login");
});
router.get("/register", (_req, res) => {
  res.render("register");
});
router.get("/logout", isAuthenticated, (req, res) => {
  req.logOut();
  req.flash("success", "با موفقیت خارج شدید");
  res.redirect("/login");
});
router.get("/forget", (_req, res) => {
  res.render("forget");
});
router.get("/reset/:token", (req, res) => {
  const { token } = req.params;
  User.findOne({ token, tokenExpireDate: { $gt: Date.now() } })
    .then((user) => {
      if (!user) {
        req.flash("error", "توکن صحیح نیست یا تاریخ مصرف گذشته است");
        return res.redirect("/forget");
      }
      return res.render("reset", { token });
    })
    .catch((err) => {
      req.flash("error", serializeError(err).message);
      return res.redirect("/forget");
    });
});
router.get("/changePassword", isAuthenticated, (req, res) => {
  res.render("changePassword", { name: req.user.name });
});
router.get("/customer/new", isAuthenticated, (req, res) => {
  res.render("customer-new", { name: req.user.name });
});
router.get("/reception/new", isAuthenticated, (req, res) => {
  res.render("reception-new", { name: req.user.name });
});
router.get("/reception/list", isAuthenticated, async (req, res) => {
  let receptions = [];
  let rs = [];
  await Reception.find({})
    .then((rec) => {
      rs = rec;
    })
    .catch(() => {
      receptions = null;
      req.flash("error", "قادر به دریافت اطلاعات نیستیم");
      return res.render("reception-list", {
        name: req.user.name,
      });
    });
  receptions = await addCustomerInfoToReception(rs);
  res.render("reception-list", { name: req.user.name, receptions });
});
router.get("/reception/edit/:id", isAuthenticated, (req, res) => {
  Reception.findOne({ _id: req.params.id })
    .then((reception) => {
      return res.render("reception-edit", {
        reception,
        name: req.body.name,
      });
    })
    .catch((err) => {
      console.log("Error from Reception findOne:", err);
      req.flash("error", deserializeError(err).message);
      return res.redirect("/reception/list");
    });
});
router.get("/reception/success/:id", isAuthenticated, (req, res) => {
  Reception.findOne({ _id: req.params.id })
    .then((reception) => {
      return res.render("reception-success", {
        name: req.body.name,
        reception,
      });
    })
    .catch((err) => {
      req.flash("error", deserializeError(err).message);
      return res.redirect("/reception/success");
    });
});
router.get("/reception/cancel/:id", isAuthenticated, (req, res) => {
  Reception.findOne({ _id: req.params.id }).then((reception) => {
    return res.render("reception-cancel", { name: req.body.name, reception });
  });
});
router.get("/reception/reject/:id", isAuthenticated, (req, res) => {
  Reception.findOne({ _id: req.params.id })
    .then((reception) => {
      if (reception) {
        return res.render("reception-reject", {
          name: req.body.name,
          reception,
        });
      }
      req.flash("error", "پذیرش یافت نشد");
      return res.redirect("/reception/list");
    })
    .catch((err) => {
      req.flash("error", deserializeError(err).message);
      return res.redirect("/reception/list");
    });
});
router.get("/doing/list", isAuthenticated, async (req, res) => {
  let receptions = [];
  let rs = [];
  await Reception.find({})
    .then((rec) => {
      rs = rec.filter((r) => {
        return r.status == Status.doing;
      });
    })
    .catch(() => {
      receptions = null;
      req.flash("error", "قادر به دریافت اطلاعات نیستیم");
      return res.render("succeded-list", {
        name: req.user.name,
        receptions,
      });
    });
  receptions = await addCustomerInfoToReception(rs);
  res.render("doing-list", { name: req.body.name, receptions });
});
router.get("/reception/doing/:id", isAuthenticated, (req, res) => {
  Reception.findOneAndUpdate({ _id: req.params.id }, { status: Status.doing })
    .then(() => {
      req.flash("success", "با موفقیت انجام شد");
      return res.redirect("/doing/list");
    })
    .catch((err) => {
      req.flash("error", deserializeError(err).message);
      return res.redirect("/doing/list");
    });
});
router.get("/succeded/list", isAuthenticated, async (req, res) => {
  let receptions = [];
  let rs = [];
  await Reception.find({})
    .then((rec) => {
      rs = rec.filter((r) => {
        return r.status == Status.succeded;
      });
    })
    .catch(() => {
      receptions = null;
      req.flash("error", "قادر به دریافت اطلاعات نیستیم");
      return res.render("succeded-list", {
        name: req.user.name,
        receptions,
      });
    });
  receptions = await addCustomerInfoToReception(rs);
  res.render("succeded-list", { name: req.body.name, receptions });
});
router.get("/canceled/list", isAuthenticated, async (req, res) => {
  let receptions = [];
  let rs = [];
  await Reception.find({})
    .then((rec) => {
      rs = rec.filter((r) => {
        return r.status == Status.canceled;
      });
    })
    .catch(() => {
      receptions = null;
      req.flash("error", "قادر به دریافت اطلاعات نیستیم");
      return res.render("canceled-list", {
        name: req.user.name,
        receptions,
      });
    });
  receptions = await addCustomerInfoToReception(rs);
  res.render("canceled-list", { name: req.body.name, receptions });
});
router.get("/rejected/list", isAuthenticated, async (req, res) => {
  let receptions = [];
  let rs = [];
  await Reception.find({})
    .then((rec) => {
      rs = rec.filter((r) => {
        return r.status == Status.rejected;
      });
    })
    .catch(() => {
      receptions = null;
      req.flash("error", "قادر به دریافت اطلاعات نیستیم");
      return res.render("rejected-list", {
        name: req.user.name,
        receptions,
      });
    });
  receptions = await addCustomerInfoToReception(rs);
  res.render("rejected-list", { name: req.body.name, receptions });
});
router.get("/delayed/list", isAuthenticated, async (req, res) => {
  let delayedReceptions = [];
  let receptions = [];
  await Reception.find({})
    .then((receptions) => {
      delayedReceptions = receptions.filter((r) => {
        return (
          elaspedDays(r.reception_id) > config.DELAY_CRITERIA &&
          r.status == Status.doing
        );
      });
    })
    .catch((err) => {
      req.flash("error", deserializeError(err).message);
      return res.redirect("/dashboard");
    });
  receptions = await addCustomerInfoToReception(delayedReceptions);
  return res.render("delayed-list", {
    name: req.body.name,
    receptions,
  });
});
/**---------------------------------------------------------
 * ?Routes
 * !POSTs
 */

router.post("/register", (req, res) => {
  if (req.body.password !== req.body.confirmPassword) {
    req.flash("error", "پسوردها یکسان نیستند");
    return res.redirect("/register");
  }
  User.register(
    { username: req.body.username, name: req.body.name, email: req.body.email },
    req.body.password
  )
    .then(() => {
      req.flash("success", "ثبت نام انجام شد");
      return res.redirect("/login");
    })
    .catch((err) => {
      req.flash("error", serializeError(err).message);
      return res.redirect("/register");
    });
});
router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/dashboard",
    // successFlash: "با موفقیت وارد شدید",
    failureRedirect: "/login",
    failureFlash: true,
  })
);
router.post("/forget", (req, res) => {
  User.findOne({ email: req.body.email })
    .then((user) => {
      if (!user) {
        req.flash("error", "این ایمیل یافت نشد");
        res.redirect("/forget");
      }
      async.waterfall([
        (done) => {
          const token = crypto.randomBytes(20).toString("hex");
          // valid for 6 hours
          const tokenExpire = Date.now() + 1000 * 60 * 60 * 6;
          done(null, token, tokenExpire);
        },
        (token, tokenExpire, done) => {
          user.token = token;
          user.tokenExpireDate = tokenExpire;
          user
            .save()
            .then(() => {
              done(null, user, token);
            })
            .catch((err) => {
              req.flash("error", deserializeError(err).message);
              return res.redirect("/forget");
            });
        },
        (user, token, done) => {
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: config.GMAIL_USERNAME,
              pass: config.GMAIL_PASSWORD,
            },
          });

          const mailOptions = {
            from: "Peyman Khalili<p.zonouz@gmail.com>",
            to: user.email,
            subject: "Recovery",
            text: `با سلام. برای بازیابی کلمه عبور خود روی لینک زیر کلیک کنید\n\n http://localhost:5000/reset/${token}`,
          };

          transporter
            .sendMail(mailOptions)
            .then(() => {
              req.flash("success", "ایمیل ارسال شد");
              res.redirect("/forget");
            })
            .catch((err) => {
              req.flash("error", deserializeError(err).message);
              return res.redirect("/forget");
            });
        },
      ]);
    })
    .catch((err) => {
      req.flash("error", serializeError(err).message);
      return res.redirect("/forget");
    });
});
router.post("/reset/:token", (req, res) => {
  const { token } = req.params;
  User.findOne({ token, tokenExpireDate: { $gt: Date.now() } })
    .then((user) => {
      if (!user) {
        req.flash("error", "توکن صحیح نیست یا تاریخ مصرف گذشته است");
        return res.redirect("/forget");
      }
      if (req.body.password !== req.body.confirmPassword) {
        req.flash("error", "پسوردها یکسان نیستند");
        return res.redirect(`/reset/${token}`);
      }
      const pass = req.body.password;
      user
        .setPassword(pass)
        .then((user) => {
          user.token = undefined;
          user.tokenExpireDate = undefined;
          user
            .save()
            .then(() => {
              req.flash("success", "پسورد با موفقیت تغییر یافت");
              return res.redirect("/login");
            })
            .catch((err) => {
              req.flash("error", serializeError(err).message);
              return res.redirect(`/reset/${token}`);
            });
        })
        .catch((err) => {
          req.flash("error", serializeError(err).message);
          return res.redirect(`/reset/${token}`);
        });
    })
    .catch((err) => {
      req.flash("error", serializeError(err).message);
      return res.redirect("/forget");
    });
});
router.post("/changePassword", isAuthenticated, (req, res) => {
  if (req.body.password !== req.body.confirmPassword) {
    req.flash("error", "پسوردها یکسان نیستند");
    return res.redirect("/changePassword");
  }
  req.user
    .changePassword(req.body.oldPassword, req.body.password)
    .then(() => {
      req.flash("success", "پسورد با موفقیت تغییر یافت");
      req.logOut();
      res.redirect("/login");
    })
    .catch(() => {
      req.flash("error", " پسورد فعلی اشتباه است");
      res.redirect("/changepassword");
    });
});
router.post("/ajax", isAuthenticated, (_req, res) => {
  Customer.find({}).then((customers) => {
    res.send(customers);
  });
});
router.post("/customer/new", isAuthenticated, (req, res) => {
  Customer.findOne({
    phoneNumber: req.body.phoneNumber,
  }).then((customer) => {
    if (customer) {
      req.flash("error", "این شماره موبایل قبلا ثبت شده است");
      return res.redirect("/customer/new");
    }
  });
  Customer.create({
    name: req.body.name,
    lastName: req.body.lastName,
    phoneNumber: req.body.phoneNumber,
  })
    .then(() => {
      req.flash("success", "یک مشتری با موفقیت ایجاد شد");
      res.redirect("/customer/new");
    })
    .catch((err) => {
      req.flash("error", deserializeError(err).message);
      res.redirect("/customer/new");
    });
});
router.post("/reception/new", isAuthenticated, async (req, res) => {
  // setting by JS new features ECMA 6
  let {
    customerPhoneNumber,
    comments,
    vehicleName,
    license,
    VIN,
    mileage,
    situation,
    pricePrediction,
    prePaid,
    things,
    spare,
    jack,
    toolBox,
    light,
    audioPlayer,
    sunroofTool,
    manual,
    sideMirror,
    footStool,
    dangerTriangle,
    logo,
    cable,
    remote,
    hubcap,
    sportRing,
    traffic,
    siren,
    ashTray,
    fireExtinguisher,
    rearWiper,
    seatCover,
    wheelWrench,
    frontWiper,
    ringLock,
    antenna,
    lace,
  } = req.body;
  // try to remove , from numbers
  pricePrediction = pricePrediction.replace(/,/g, "");
  prePaid = prePaid.replace(/,/g, "");
  mileage = mileage.replace(/,/g, "");

  // req.body data but to checkboxs
  const date = new Date();
  const formData = {
    reception_id: date.toISOString(),
    status: Status.doing,
    customerPhoneNumber,
    comments,
    vehicleName,
    license,
    VIN,
    mileage,
    situation,
    pricePrediction,
    prePaid,
    things,
    spare,
    jack,
    toolBox,
    light,
    audioPlayer,
    sunroofTool,
    manual,
    sideMirror,
    footStool,
    dangerTriangle,
    logo,
    cable,
    remote,
    hubcap,
    sportRing,
    traffic,
    siren,
    ashTray,
    fireExtinguisher,
    rearWiper,
    seatCover,
    wheelWrench,
    frontWiper,
    ringLock,
    antenna,
    lace,
  };

  await Reception.create(formData)
    .then(() => {
      req.flash("success", "پذیرش با موفقیت انجام شد");
      return res.redirect("/reception/new");
    })
    .catch((err) => {
      req.flash("error", deserializeError(err).message);
      return res.redirect("/reception/new");
    });
});
router.post("/reception/edit/:id", isAuthenticated, async (req, res) => {
  // setting by JS new features ECMA 6
  let {
    customerPhoneNumber,
    comments,
    vehicleName,
    license,
    VIN,
    mileage,
    situation,
    pricePrediction,
    prePaid,
    things,
    spare,
    jack,
    toolBox,
    light,
    audioPlayer,
    sunroofTool,
    manual,
    sideMirror,
    footStool,
    dangerTriangle,
    logo,
    cable,
    remote,
    hubcap,
    sportRing,
    traffic,
    siren,
    ashTray,
    fireExtinguisher,
    rearWiper,
    seatCover,
    wheelWrench,
    frontWiper,
    ringLock,
    antenna,
    lace,
  } = req.body;
  // try to remove , from numbers
  pricePrediction = pricePrediction.replace(/,/g, "");
  prePaid = prePaid.replace(/,/g, "");
  mileage = mileage.replace(/,/g, "");
  const date = new Date();
  // let modificationDate = date.now();
  // req.body data but eo checkboxs
  const formData = {
    // reception_id: date.toISOString(),
    status: Status.doing,
    customerPhoneNumber,
    comments,
    vehicleName,
    license,
    VIN,
    mileage,
    situation,
    pricePrediction,
    prePaid,
    things,
    spare,
    jack,
    toolBox,
    light,
    audioPlayer,
    sunroofTool,
    manual,
    sideMirror,
    footStool,
    dangerTriangle,
    logo,
    cable,
    remote,
    hubcap,
    sportRing,
    traffic,
    siren,
    ashTray,
    fireExtinguisher,
    rearWiper,
    seatCover,
    wheelWrench,
    frontWiper,
    ringLock,
    antenna,
    lace,
  };
  formData[
    `modification-${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}-${date.getMinutes()}-${date.getSeconds()}`
  ] = date.toISOString();
  await Reception.updateOne({ _id: req.params.id }, formData)
    .then(() => {
      req.flash("success", "ویرایش با موفقیت انجام شد");
      return res.redirect(`/reception/edit/${req.params.id}`);
    })
    .catch((err) => {
      req.flash("error", deserializeError(err).message);
      return res.redirect(`/reception/edit/${req.params.id}`);
    });
});
router.post("/reception/remove/:id", isAuthenticated, (req, res) => {
  Reception.findOneAndDelete({ _id: req.params.id })
    .then(() => {
      req.flash("success", "با موفقیت حذف گردید");
      return res.redirect("/reception/list");
    })
    .catch((err) => {
      req.flash("error", serializeError(err).message);
      return res.redirect("/reception/list");
    });
});
router.post("/reception/success/:id", isAuthenticated, (req, res) => {
  const finalPayment = req.body.finalPayment.replace(/,/g, "");
  successComment = req.body.successComment;
  const status = Status.succeded;
  Reception.findOneAndUpdate(
    { _id: req.params.id },
    { status, successComment, finalPayment }
  )
    .then(() => {
      req.flash("success", "با موفقیت انجام شد");
      return res.redirect("/reception/list");
    })
    .catch((err) => {
      req.flash("error", deserializeError(err).message);
      return res.redirect("/reception/list");
    });
});
router.post("/reception/cancel/:id", isAuthenticated, (req, res) => {
  const cancelPayment = req.body.cancelPayment.replace(/,/g, "");
  const { cancelComment } = req.body;
  const status = Status.canceled;
  Reception.findOneAndUpdate(
    { _id: req.params.id },
    {
      status,
      cancelPayment,
      cancelComment,
    }
  )
    .then(() => {
      req.flash("success", "با موفقیت انجام شد");
      return res.redirect("/reception/list");
    })
    .catch((err) => {
      req.flash("error", deserializeError(err).message);
      return res.redirect("/reception/list");
    });
});
router.post("/reception/reject/:id", isAuthenticated, (req, res) => {
  const rejectPayment = req.body.rejectPayment.replace(/,/g, "");
  const { rejectComment } = req.body;
  const status = Status.rejected;
  Reception.findOneAndUpdate(
    { _id: req.params.id },
    {
      status,
      rejectPayment,
      rejectComment,
    }
  )
    .then(() => {
      req.flash("success", "با موفقیت انجام شد");
      return res.redirect("/reception/list");
    })
    .catch((err) => {
      req.flash("error", deserializeError(err).message);
      return res.redirect("/reception/list");
    });
});

module.exports = router;
