const cool = require("cool-ascii-faces");
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
const { Reception, Status } = require("../models/Reception");
const User = require("../models/User");
const { Log, Operation } = require("../models/Logs");
/**---------------------------------------------------------
 * !Global Variables
 */

/**---------------------------------------------------------
 * !Helper Methods
 */
// const isToday = (d) => {
//   const date = new Date(d);
//   const today = new Date();
//   return (
//     today.getDate() === date.getDate() &&
//     today.getMonth() === date.getMonth() &&
//     today.getFullYear === date.getFullYear
//   );
// };
const translateStatustoFarsi = (status) => {
  if (status === "doing") return "در حال انجام";
  if (status === "rejected") return "نا موفق";
  if (status === "canceled") return "کنسلی";
  if (status === "dalayed") return "با تاخیر";
  if (status === "succeded") return "آماده";
  if (status === "returned") return "برگشتی";
  return "خطا";
};
const elaspedDays = (d) => {
  const date = new Date(d);
  const miliseconds = Date.now() - date;
  const days = miliseconds / (1000 * 60 * 60 * 24);
  return days;
};
const addJalaliDateToReception = (reception) => {
  const date = new Date(reception.receptionId);
  const dateTime = new Intl.DateTimeFormat("en-US").format(date);
  // get jalali data (https://www.npmjs.com/package/jalali-moment)
  const m = moment.from(dateTime, "en", "MM/DD/YYYY");
  const jDate = m.format("jYYYY/jMM/jDD");
  // makeing 2 digit hour and minute
  const time = `${(date.getHours() < 10 ? "0" : "") + date.getHours()}:${
    (date.getMinutes() < 10 ? "0" : "") + date.getMinutes()
  }`;
  Object.assign(reception, { date: jDate }); // reception.date = jDate;
  Object.assign(reception, { time }); // reception.time = time;
  return reception;
};
const addJalaliDateToLog = (log) => {
  const date = new Date(log.log_id);
  const dateTime = new Intl.DateTimeFormat("en-US").format(date);
  // get jalali data (https://www.npmjs.com/package/jalali-moment)
  const m = moment.from(dateTime, "en", "MM/DD/YYYY");
  const jDate = m.format("jYYYY/jMM/jDD");
  // makeing 2 digit hour and minute
  const time = `${(date.getHours() < 10 ? "0" : "") + date.getHours()}:${
    (date.getMinutes() < 10 ? "0" : "") + date.getMinutes()
  }`;
  Object.assign(log, { date: jDate }); // log.date = jDate;
  Object.assign(log, time); // log.time = time;
  return log;
};
const addCustomerInfoToReceptions = async (rs) => {
  const receptions = [];
  let reception = {};
  await Promise.all(
    rs.map(async (r) => {
      // reception Data-time to Jalali
      reception = addJalaliDateToReception(r);
      // reception status
      reception.status = translateStatustoFarsi(reception.status);
      await Customer.findOne({
        phoneNumber: reception.customerPhoneNumber,
      }).then((customer) => {
        if (customer) {
          reception.customerName = customer.name;
          reception.customerLastname = customer.lastName;
          return receptions.push(reception);
        }
        return 0;
      });
      //  .catch((err) => {});
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

/**---------------------------------------------------------
 * ?Routes
 * !GETs
 */
router.get("/cool", (_req, res) => {
  res.send(cool());
});
router.get("/", (_req, res) => {
  // debugger;
  res.render("index");
});
router.get("/dashboard", isAuthenticated, async (req, res) => {
  let totalReceptions = 0;
  const todayTotalReceptions = 0;
  let doingCount = 0;
  let rejectedCount = 0;
  let returnedCount = 0;
  let customerCount = 0;
  let canceledCount = 0;
  let delayedCount = 0;
  let succededCount = 0;
  await Reception.find({}).then((receptions) => {
    totalReceptions = receptions.length;
    // loop all receptions
    for (let i = 0; i < receptions.length; i += 1) {
      // // check dates(receptionId)
      // if (isToday(reception.receptionId)) {
      //   todayTotalReceptions++;
      //   returnedTodayCount++;
      // }
      // check Status
      if (receptions[i].status === "doing") {
        doingCount += 1;
      }
      if (receptions[i].status === "rejected") {
        rejectedCount += 1;
      }
      if (receptions[i].status === "canceled") {
        canceledCount += 1;
      }
      if (
        elaspedDays(receptions[i].receptionId) > config.DELAY_CRITERIA &&
        receptions[i].status === Status.doing
      ) {
        delayedCount += 1;
      }
      if (receptions[i].status === "succeded") {
        succededCount += 1;
      }
      if (receptions[i].status === "returned") {
        returnedCount += 1;
      }
    }
  });
  await Customer.find({}).then((customers) => {
    customerCount = customers.length;
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
    customerCount,
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
  receptions = await addCustomerInfoToReceptions(rs);
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
        return r.status === Status.doing;
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
  receptions = await addCustomerInfoToReceptions(rs);
  res.render("doing-list", { name: req.body.name, receptions });
});
router.get("/succeded/list", isAuthenticated, async (req, res) => {
  let receptions = [];
  let rs = [];
  await Reception.find({})
    .then((rec) => {
      rs = rec.filter((r) => {
        return r.status === Status.succeded;
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
  receptions = await addCustomerInfoToReceptions(rs);
  res.render("succeded-list", { name: req.body.name, receptions });
});
router.get("/canceled/list", isAuthenticated, async (req, res) => {
  let receptions = [];
  let rs = [];
  await Reception.find({})
    .then((rec) => {
      rs = rec.filter((r) => {
        return r.status === Status.canceled;
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
  receptions = await addCustomerInfoToReceptions(rs);
  res.render("canceled-list", { name: req.body.name, receptions });
});
router.get("/rejected/list", isAuthenticated, async (req, res) => {
  let receptions = [];
  let rs = [];
  await Reception.find({})
    .then((rec) => {
      rs = rec.filter((r) => {
        return r.status === Status.rejected;
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
  receptions = await addCustomerInfoToReceptions(rs);
  res.render("rejected-list", { name: req.body.name, receptions });
});
router.get("/delayed/list", isAuthenticated, async (req, res) => {
  let delayedReceptions = [];
  let receptions = [];
  await Reception.find({})
    .then((rs) => {
      delayedReceptions = rs.filter((r) => {
        return (
          elaspedDays(r.receptionId) > config.DELAY_CRITERIA &&
          r.status === Status.doing
        );
      });
    })
    .catch((err) => {
      req.flash("error", deserializeError(err).message);
      return res.redirect("/dashboard");
    });
  receptions = await addCustomerInfoToReceptions(delayedReceptions);
  return res.render("delayed-list", {
    name: req.body.name,
    receptions,
  });
});
router.get("/reception/report/:id", isAuthenticated, async (req, res) => {
  async.waterfall(
    [
      (done) => {
        Reception.find({ _id: req.params.id })
          .then((receptions) => {
            done(null, receptions);
          })
          .catch((err) => {
            done(err);
          });
      },
      async (receptions, done) => {
        const r = await addCustomerInfoToReceptions(receptions);
        done(null, r);
      },
      (receptions, done) => {
        const reception = receptions[0];
        Log.find({ receptionId: receptions[0].receptionId })
          .then((logs) => {
            const logsWithJalaliDate = logs.map((log) =>
              addJalaliDateToLog(log)
            );
            res.render("reception-report", {
              name: req.user.name,
              logsWithJalaliDate,
              addJalaliDateToLog,
              reception,
              translateStatustoFarsi,
            });
          })
          .catch((err) => {
            done(err);
          });
      },
    ],
    (err) => {
      req.flash("error", deserializeError(err).message);
      res.redirect("/reception/list");
    }
  );
});
router.get("/reception/toDoing/:id", isAuthenticated, async (req, res) => {
  await Reception.findOne({ _id: req.params.id })
    .then((reception) => {
      res.render("reception-toDoing", { reception, name: req.user.name });
    })
    .catch((err) => {
      req.flash("error", deserializeError(err).message);
      res.redirect("/reception-list", { name: req.user.name });
    });
});
router.get("/customer/list", (req, res) => {
  Customer.find({})
    .then((customers) => {
      res.render("customer-list", { name: req.user.name, customers });
    })
    .catch((err) => {
      req.flash("error", deserializeError(err).message);
      res.redirect("/dashboard");
    });
});
router.get("/customer/edit/:id", (req, res) => {
  Customer.findOne({ _id: req.params.id })
    .then((customer) => {
      if (!customer) {
        req.flash("error", "مشنری پیدا نشد");
        return res.redirect("/customer/list");
      }
      return res.render("customer-edit", { name: req.user.name, customer });
    })
    .catch((err) => {
      req.flash("error", deserializeError(err).message);
      res.redirect("/customer/list");
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
  return 0;
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
        return res.redirect("/forget");
      }
      async.waterfall([
        (done) => {
          const token = crypto.randomBytes(20).toString("hex");
          // valid for 6 hours
          const tokenExpire = Date.now() + 1000 * 60 * 60 * 6;
          done(null, token, tokenExpire);
        },
        (token, tokenExpire, done) => {
          Object.assign(user, { token });
          Object.assign(user, { tokenExpire });
          user
            .save()
            .then(() => {
              done(null, user.email, token);
            })
            .catch((err) => {
              req.flash("error", deserializeError(err).message);
              return res.redirect("/forget");
            });
        },
        (email, token, done) => {
          const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
              user: config.GMAIL_USERNAME,
              pass: config.GMAIL_PASSWORD,
            },
          });

          const mailOptions = {
            from: "Peyman Khalili",
            to: email,
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
          done();
        },
      ]);
      return 0;
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
        .then((sameUser) => {
          Object.assign(sameUser, { token: undefined });
          Object.assign(sameUser, { tokenExpireDate: undefined });
          sameUser
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
      return 0;
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
  return 0;
});
router.post("/ajax", isAuthenticated, (_req, res) => {
  Customer.find({}).then((customers) => {
    res.send(customers);
  });
});
router.post("/customer/new", isAuthenticated, async (req, res) => {
  let duplicatedPhoneNumber = false;
  await Customer.findOne({
    phoneNumber: req.body.phoneNumber,
  }).then((customer) => {
    if (customer) {
      req.flash("error", "این شماره موبایل قبلا ثبت شده است");
      res.redirect("/customer/new");
      duplicatedPhoneNumber = true;
    }
  });
  if (!duplicatedPhoneNumber) {
    await Customer.create({
      name: req.body.name,
      lastName: req.body.lastName,
      phoneNumber: req.body.phoneNumber,
    })
      .then(() => {
        req.flash("success", "یک مشتری با موفقیت ایجاد شد");
        return res.redirect("/customer/new");
      })
      .catch((err) => {
        req.flash("error", deserializeError(err).message);
        return res.redirect("/customer/new");
      });
  }
});
router.post("/customer/new/ajax", isAuthenticated, async (req, res) => {
  let duplicatedPhoneNumber = false;
  await Customer.findOne({
    phoneNumber: req.body.phoneNumber,
  }).then((customer) => {
    if (customer) {
      res.send({
        status: "error",
        msg: "شماره موبایل قبلا ثبت شده است",
      });
      duplicatedPhoneNumber = true;
    }
  });
  if (!duplicatedPhoneNumber) {
    await Customer.create({
      name: req.body.name,
      lastName: req.body.lastName,
      phoneNumber: req.body.phoneNumber,
    })
      .then(() => {
        return res.send({
          status: "success",
          msg: "یک مشتری با موفقیت ایجاد شد",
        });
      })
      .catch((err) => {
        return res.send({
          status: "error",
          msg: deserializeError(err).message,
        });
      });
  }
});
router.post("/reception/new", isAuthenticated, async (req, res) => {
  const { customerPhoneNumber } = req.body;
  const { comments } = req.body;
  const { vehicleName } = req.body;
  const { license } = req.body;
  const { VIN } = req.body;
  const { situation } = req.body;
  const { things } = req.body;
  const spare = req.body.spare || 0;
  const jack = req.body.jack || 0;
  const toolBox = req.body.toolBox || 0;
  const light = req.body.light || 0;
  const audioPlayer = req.body.audioPlayer || 0;
  const sunroofTool = req.body.sunroofTool || 0;
  const manual = req.body.manual || 0;
  const sideMirror = req.body.sideMirror || 0;
  const footStool = req.body.footStool || 0;
  const dangerTriangle = req.body.dangerTriangle || 0;
  const logo = req.body.logo || 0;
  const cable = req.body.cable || 0;
  const remote = req.body.remote || 0;
  const hubcap = req.body.hubcapb || 0;
  const sportRing = req.body.sportRing || 0;
  const traffic = req.body.traffic || 0;
  const siren = req.body.siren || 0;
  const ashTray = req.body.ashTray || 0;
  const fireExtinguisher = req.body.fireExtinguisher || 0;
  const rearWiper = req.body.rearWiper || 0;
  const seatCover = req.body.seatCover || 0;
  const wheelWrench = req.body.wheelWrench || 0;
  const frontWiper = req.body.frontWiper || 0;
  const ringLock = req.body.ringLock || 0;
  const antenna = req.body.antenna || 0;
  const lace = req.body.lace || 0;
  // tryto remove , from numbers
  const pricePrediction = req.body.pricePrediction.replace(/,/g, "");
  const prePaid = req.body.prePaid.replace(/,/g, "");
  const mileage = req.body.mileage.replace(/,/g, "");
  // let modificationDate = date.now();
  // req.body data but eo checkboxs
  const formData = {
    receptionId: Date.now(),
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
  async.waterfall(
    [
      (done) => {
        Reception.create(formData)
          .then(() => {
            req.flash("success", "پذیرش با موفقیت انجام شد");
            res.redirect("/reception/new");
            done(null, formData.receptionId);
          })
          .catch((err) => {
            done(err);
          });
      },
      (receptionId, done) => {
        Log.create({
          receptionNewStatus: Status.doing,
          operationType: Operation.create,
          receptionId,
          username: req.user.username,
          log_id: Date.now(),
        })
          .then(() => {})
          .catch((err) => {
            done(err);
          });
      },
    ],
    () => {}
  );
});
router.post("/reception/edit/:id", isAuthenticated, async (req, res) => {
  const { status } = req.body;
  const { receptionId } = req.body;
  const { customerPhoneNumber } = req.body;
  const { comments } = req.body;
  const { vehicleName } = req.body;
  const { license } = req.body;
  const { VIN } = req.body;
  const { situation } = req.body;
  const { things } = req.body;
  const spare = req.body.spare || 0;
  const jack = req.body.jack || 0;
  const toolBox = req.body.toolBox || 0;
  const light = req.body.light || 0;
  const audioPlayer = req.body.audioPlayer || 0;
  const sunroofTool = req.body.sunroofTool || 0;
  const manual = req.body.manual || 0;
  const sideMirror = req.body.sideMirror || 0;
  const footStool = req.body.footStool || 0;
  const dangerTriangle = req.body.dangerTriangle || 0;
  const logo = req.body.logo || 0;
  const cable = req.body.cable || 0;
  const remote = req.body.remote || 0;
  const hubcap = req.body.hubcapb || 0;
  const sportRing = req.body.sportRing || 0;
  const traffic = req.body.traffic || 0;
  const siren = req.body.siren || 0;
  const ashTray = req.body.ashTray || 0;
  const fireExtinguisher = req.body.fireExtinguisher || 0;
  const rearWiper = req.body.rearWiper || 0;
  const seatCover = req.body.seatCover || 0;
  const wheelWrench = req.body.wheelWrench || 0;
  const frontWiper = req.body.frontWiper || 0;
  const ringLock = req.body.ringLock || 0;
  const antenna = req.body.antenna || 0;
  const lace = req.body.lace || 0;
  // tryto remove , from numbers
  const pricePrediction = req.body.pricePrediction.replace(/,/g, "");
  const prePaid = req.body.prePaid.replace(/,/g, "");
  const mileage = req.body.mileage.replace(/,/g, "");
  // let modificationDate = date.now();
  // req.body data but eo checkboxs
  const formData = {
    status,
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
  async.waterfall(
    [
      (done) => {
        Reception.findOneAndUpdate({ _id: req.params.id }, formData)
          .then(() => {
            req.flash("success", "ویرایش با موفقیت انجام شد");
            res.redirect(`/reception/edit/${req.params.id}`);
            done(null, receptionId);
          })
          .catch((err) => {
            done(err);
          });
      },
      (recId, done) => {
        Log.create({
          receptionNewStatus: status,
          operationType: Operation.modify,
          receptionId: Number(recId),
          username: req.user.username,
          log_id: Date.now(),
        })
          .then(() => {})
          .catch((err) => {
            done(err);
          });
      },
    ],
    (err) => {
      req.flash("error", deserializeError(err).message);
      res.redirect(`/reception/edit/${req.params.id}`);
    }
  );
});
router.post("/reception/remove/:id", isAuthenticated, (req, res) => {
  async.waterfall(
    [
      (done) => {
        Reception.findOne({ _id: req.params.id }).then((reception) => {
          return done(null, reception.receptionId);
        });
      },
      (receptionId, done) => {
        Reception.findOneAndDelete({ _id: req.params.id })
          .then(() => {
            req.flash("success", "با موفقیت حذف گردید");
            res.redirect("/reception/list");
            done(null, receptionId);
          })
          .catch((err) => {
            done(err);
          });
      },
      (receptionId, done) => {
        Log.create({
          operationType: Operation.remove,
          receptionId,
          username: req.user.username,
          log_id: Date.now(),
        })
          .then(() => {})
          .catch((err) => {
            done(err);
          });
      },
    ],
    (err) => {
      req.flash("error", deserializeError(err).message);
      res.redirect("/reception/list");
    }
  );
});
router.post("/reception/success/:id", isAuthenticated, (req, res) => {
  const finalPayment = req.body.finalPayment.replace(/,/g, "");
  const { successComment } = req.body;
  const status = Status.succeded;
  async.waterfall(
    [
      (done) => {
        Reception.findOneAndUpdate(
          { _id: req.params.id },
          { status, successComment, finalPayment }
        )
          .then(() => {
            req.flash("success", "با موفقیت انجام شد");
            res.redirect("/succeded/list");
            done(null);
          })
          .catch((err) => {
            done(err);
          });
      },
      (done) => {
        Reception.findOne({ _id: req.params.id }).then((reception) => {
          return done(null, reception.receptionId);
        });
      },
      (receptionId, done) => {
        Log.create({
          comment: successComment,
          payment: finalPayment,
          receptionNewStatus: Status.succeded,
          operationType: Operation.changeStatus,
          receptionId,
          username: req.user.username,
          log_id: Date.now(),
        })
          .then(() => {})
          .catch(() => {});
        done();
      },
    ],
    (err) => {
      req.flash("error", deserializeError(err).message);
      res.redirect(`/reception/edit/${req.params.id}`);
    }
  );
});
router.post("/reception/cancel/:id", isAuthenticated, (req, res) => {
  const cancelPayment = req.body.cancelPayment.replace(/,/g, "");
  const { cancelComment } = req.body;
  const status = Status.canceled;
  async.waterfall([
    (done) => {
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
          done(null);
          return res.redirect("/reception/list");
        })
        .catch((err) => {
          req.flash("error", deserializeError(err).message);
          return res.redirect("/reception/list");
        });
    },
    (done) => {
      Log.create({
        comment: cancelComment,
        payment: cancelPayment,
        receptionNewStatus: status,
        operationType: Operation.changeStatus,
        receptionId: req.body.receptionId,
        username: req.user.username,
        log_id: Date.now(),
      });
      done();
    },
  ]);
});
router.post("/reception/reject/:id", isAuthenticated, (req, res) => {
  const rejectPayment = req.body.rejectPayment.replace(/,/g, "");
  const { rejectComment } = req.body;
  const status = Status.rejected;
  async.waterfall([
    (done) => {
      Reception.findOneAndUpdate(
        { _id: req.params.id },
        {
          status,
          rejectPayment,
          rejectComment,
        }
      )
        .then(() => {
          done(null);
          req.flash("success", "با موفقیت انجام شد");
          return res.redirect("/reception/list");
        })
        .catch((err) => {
          req.flash("error", deserializeError(err).message);
          return res.redirect("/reception/list");
        });
    },
    (done) => {
      Log.create({
        comment: rejectComment,
        payment: rejectPayment,
        receptionNewStatus: status,
        operationType: Operation.changeStatus,
        receptionId: req.body.receptionId,
        username: req.user.username,
        log_id: Date.now(),
      });
      done();
    },
  ]);
});
router.post("/reception/toDoing/:id", isAuthenticated, (req, res) => {
  async.waterfall([
    (done) => {
      Reception.findOne({ _id: req.params.id })
        .then((reception) => {
          done(null, reception);
        })
        .catch();
    },
    (reception, done) => {
      Reception.findOneAndUpdate(
        { _id: req.params.id },
        { status: Status.doing, toDoingComment: req.body.toDoingComment }
      )
        .then(() => {
          done(null, reception);
          req.flash("success", "با موفقیت انجام شد");
          return res.redirect("/doing/list");
        })
        .catch((err) => {
          req.flash("error", deserializeError(err).message);
          return res.redirect("/doing/list");
        });
    },
    (reception, done) => {
      Log.create({
        comment: req.body.toDoingComment,
        receptionNewStatus: Status.doing,
        operationType: Operation.changeStatus,
        receptionId: reception.receptionId,
        username: req.user.username,
        log_id: Date.now(),
      });
      done();
    },
  ]);
});
router.post("/customer/edit/:id", (req, res) => {
  Customer.findOneAndUpdate(
    { _id: req.params.id },
    {
      name: req.body.name,
      lastName: req.body.lastName,
      phoneNumber: req.body.phoneNumber,
    }
  )
    .then(() => {
      req.flash("success", "با موفقیت انجام شد");
      return res.redirect(`/customer/edit/${req.params.id}`);
    })
    .catch((err) => {
      req.flash("error", deserializeError(err).message);
      return res.redirect(`/customer/edit/${req.params.id}`);
    });
});
router.post("/customer/remove/:id", async (req, res) => {
  let ended = false;
  await Customer.findOne({ _id: req.params.id })
    .then(async (customer) => {
      await Reception.find({ customerPhoneNumber: customer.phoneNumber })
        .then((receptions) => {
          if (receptions.length > 0) {
            ended = true;
            req.flash("error", "برای این مشتری پذیرش ثبت شده است");
            return res.redirect("/customer/list");
          }
          return 0;
        })
        .catch((err) => {
          ended = true;
          req.flash("error", deserializeError(err).message);
          return res.redirect("/customer/list");
        });
    })
    .catch(() => {});
  if (ended) {
    return;
  }
  await Customer.findOneAndDelete({ _id: req.params.id })
    .then(() => {
      req.flash("success", "با موفقیت انجام شد");
      res.redirect("/customer/list");
    })
    .catch((err) => {
      req.flash("error", deserializeError(err).message);
      res.redirect("/customer/list");
    });
});

module.exports = router;
