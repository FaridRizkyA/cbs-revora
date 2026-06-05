const express = require("express");
const {
  listRoles,
  uploadProfileImage,
  getUserProfile,
  updateUserProfile,
  changeUserPassword,
  listStaffGrades,
  createStaffGrade,
  updateStaffGrade,
  updateStaffGradeStatus,
  listUsers,
  createUser,
  updateUser,
  updateUserStatus,
  listMembers,
  createMember,
  updateMember,
  updateMemberStatus,
  listStaffs,
  createStaff,
  updateStaff,
  updateStaffStatus,
} = require("../modules/people/peopleController");

const router = express.Router();

router.get("/people/roles", listRoles);
router.post("/people/profile-image", uploadProfileImage);
router.get("/people/staff-grades", listStaffGrades);
router.post("/people/staff-grades", createStaffGrade);
router.put("/people/staff-grades/:id", updateStaffGrade);
router.patch("/people/staff-grades/:id/status", updateStaffGradeStatus);

router.get("/people/users", listUsers);
router.get("/people/users/:id/profile", getUserProfile);
router.post("/people/users", createUser);
router.put("/people/users/:id", updateUser);
router.put("/people/users/:id/profile", updateUserProfile);
router.patch("/people/users/:id/password", changeUserPassword);
router.patch("/people/users/:id/status", updateUserStatus);

router.get("/people/members", listMembers);
router.post("/people/members", createMember);
router.put("/people/members/:id", updateMember);
router.patch("/people/members/:id/status", updateMemberStatus);

router.get("/people/staffs", listStaffs);
router.post("/people/staffs", createStaff);
router.put("/people/staffs/:id", updateStaff);
router.patch("/people/staffs/:id/status", updateStaffStatus);

module.exports = router;
